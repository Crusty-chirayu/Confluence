// =====================================================================
// attachment-processor — V3.0 attachment processing pipeline
//
// Handles secure attachment processing:
// 1. Validates attachment exists and caller has authorization
// 2. Retrieves private file from storage
// 3. Extracts text content using the extraction layer
// 4. Normalizes and chunks content
// 5. Persists chunks to database
// 6. Handles idempotency and retries safely
// =====================================================================

import { preflight, corsHeaders, json } from "../_shared/cors.ts";
import { requireUser, adminClient, HttpError, userClient } from "../_shared/supabase.ts";
import {
  extractText,
  chunkText,
  generateChunkLabels,
  estimateTokenCount,
  type ChunkConfig,
} from "../_shared/extract.ts";
import { generateEmbeddings } from "../_shared/embeddings.ts";

interface Body {
  attachment_id: string;
}

const CHUNK_CONFIG: ChunkConfig = {
  maxChars: 1000,
  overlapChars: 200,
};

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSION = 1536; // OpenAI text-embedding-3-small dimension
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  try {
    // Authenticate the caller and verify they are a valid user
    const { user, authHeader } = await requireUser(req);
    const admin = adminClient();
    const userSupa = userClient(authHeader);

    const body = (await req.json()) as Body;
    const attachmentId = body.attachment_id;
    if (!attachmentId) {
      throw new HttpError(400, "attachment_id_required");
    }

    // 1. Verify attachment exists and get metadata
    const { data: attachment, error: attErr } = await admin
      .from("message_attachments")
      .select("id, message_id, storage_path, mime_type, size_bytes")
      .eq("id", attachmentId)
      .single();

    if (attErr || !attachment) {
      throw new HttpError(404, "attachment_not_found");
    }

    // 2. Get message to verify conversation access
    const { data: message, error: msgErr } = await admin
      .from("messages")
      .select("conversation_id")
      .eq("id", attachment.message_id)
      .single();

    if (msgErr || !message) {
      throw new HttpError(404, "message_not_found");
    }

    // 3. Verify the caller is a member of the conversation (using user client to respect RLS)
    const { data: member, error: memberErr } = await userSupa
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", message.conversation_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberErr || !member) {
      throw new HttpError(403, "not_conversation_member");
    }

    // 3. Check if already processed (idempotency)
    const { data: existingChunks } = await admin
      .from("attachment_chunks")
      .select("id")
      .eq("attachment_id", attachmentId)
      .limit(1);

    if (existingChunks && existingChunks.length > 0) {
      // Already processed, return success idempotently
      return json(req, { 
        success: true, 
        message: "already_processed",
        chunk_count: existingChunks.length 
      }, 200);
    }

    // 4. Retrieve file from storage
    const { data: fileData, error: downloadErr } = await admin
      .storage
      .from("attachments")
      .download(attachment.storage_path);

    if (downloadErr || !fileData) {
      throw new HttpError(500, "file_download_failed");
    }

    // Extract filename from storage path for validation
    const pathParts = attachment.storage_path.split("/");
    const filename = pathParts[pathParts.length - 1] || "unknown";

    // 5. Extract text content
    const extractionResult = await extractText(
      filename,
      attachment.mime_type,
      new Uint8Array(await fileData.arrayBuffer()),
    );

    // 6. Chunk the extracted text
    const chunks = chunkText(extractionResult.text, CHUNK_CONFIG);

    if (chunks.length === 0) {
      // Empty extraction - still mark as processed but with no chunks
      return json(req, { 
        success: true, 
        message: "empty_extraction",
        chunk_count: 0 
      }, 200);
    }

    // 7. Generate labels for chunks
    const labels = generateChunkLabels(chunks, {
      filename: extractionResult.metadata.filename,
      pageCount: extractionResult.metadata.pageCount,
    });

    // 8. Prepare chunk records for insertion
    const chunkRecords = chunks.map((chunk, i) => ({
      attachment_id: attachmentId,
      chunk_index: chunk.index,
      content: chunk.content,
      label: labels[i],
      token_count: estimateTokenCount(chunk.content),
      // Embedding will be added after generation
      embedding: null,
    }));

    // 9. Generate embeddings if API key is available
    let embeddings: number[][] = [];
    if (OPENAI_API_KEY) {
      try {
        const chunkTexts = chunks.map((chunk) => chunk.content);
        embeddings = await generateEmbeddings(chunkTexts, OPENAI_API_KEY, EMBEDDING_MODEL);
        
        // Verify embedding dimensions
        if (embeddings.length > 0 && embeddings[0].length !== EMBEDDING_DIMENSION) {
          console.warn("attachment-processor: embedding_dimension_mismatch", 
            `Expected ${EMBEDDING_DIMENSION}, got ${embeddings[0].length}`);
          embeddings = []; // Fall back to no embeddings if dimension mismatch
        }
      } catch (embeddingError) {
        console.error("attachment-processor: embedding_generation_failed", embeddingError);
        // Continue without embeddings - FTS will still work
        embeddings = [];
      }
    }

    // 10. Add embeddings to chunk records
    if (embeddings.length > 0) {
      for (let i = 0; i < chunkRecords.length; i++) {
        if (i < embeddings.length) {
          chunkRecords[i].embedding = embeddings[i];
        }
      }
    }

    // 11. Insert chunks in a transaction
    const { error: insertErr } = await admin
      .from("attachment_chunks")
      .insert(chunkRecords);

    if (insertErr) {
      console.error("attachment-processor: chunk_insert_failed", insertErr);
      throw new HttpError(500, "chunk_insert_failed");
    }

    return json(req, {
      success: true,
      message: "processing_complete",
      chunk_count: chunks.length,
      metadata: {
        filename: extractionResult.metadata.filename,
        mime_type: extractionResult.metadata.mimeType,
        size_bytes: extractionResult.metadata.sizeBytes,
        extracted_at: extractionResult.metadata.extractedAt,
      },
    }, 200);

  } catch (e) {
    if (e instanceof HttpError) {
      return json(req, { error: e.code, detail: e.detail ?? null }, e.status);
    }
    console.error("attachment-processor: internal_error", e);
    return json(req, { error: "internal_error", detail: null }, 500);
  }
});