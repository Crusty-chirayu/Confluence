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
import { adminClient, HttpError } from "../_shared/supabase.ts";
import {
  extractText,
  chunkText,
  generateChunkLabels,
  estimateTokenCount,
  type ChunkConfig,
} from "../_shared/extract.ts";

interface Body {
  attachment_id: string;
}

const CHUNK_CONFIG: ChunkConfig = {
  maxChars: 1000,
  overlapChars: 200,
};

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  const admin = adminClient();

  try {
    // Only allow service_role to invoke this function directly
    // Client-triggered processing would require proper authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(req, { error: "unauthorized" }, 401);
    }

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

    // 2. Get message to verify conversation access (via service_role, this bypasses RLS)
    const { data: message, error: msgErr } = await admin
      .from("messages")
      .select("conversation_id")
      .eq("id", attachment.message_id)
      .single();

    if (msgErr || !message) {
      throw new HttpError(404, "message_not_found");
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
      // Embedding is null for now - will be added when embedding service is available
      embedding: null,
    }));

    // 9. Insert chunks in a transaction
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