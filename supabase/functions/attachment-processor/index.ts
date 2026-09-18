// =====================================================================
// attachment-processor — V3.0 attachment processing pipeline
//
// Handles secure attachment processing:
// 1. Validates attachment exists and caller has authorization
// 2. Retrieves private file from storage
// 3. Extracts text content using the extraction layer
// 4. Normalizes and chunks content (page-preserving for PDFs)
// 5. Generates embeddings in bounded batches and persists chunks
// 6. Tracks processing status honestly: queued -> processing -> ready|failed
// 7. Handles idempotency and retries safely
// =====================================================================

import { preflight, corsHeaders, json } from "../_shared/cors.ts";
import { requireUser, adminClient, HttpError, userClient } from "../_shared/supabase.ts";
import {
  extractText,
  chunkPages,
  chunkText,
  generateChunkLabels,
  estimateTokenCount,
  type ChunkConfig,
} from "../_shared/extract.ts";
import { generateEmbeddings, EMBEDDING_DIMENSION } from "../_shared/embeddings.ts";

interface Body {
  attachment_id: string;
}

const CHUNK_CONFIG: ChunkConfig = {
  maxChars: 1000,
  overlapChars: 200,
};

const EMBEDDING_MODEL = "text-embedding-3-small";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

/** Max text chunks sent to the embedding API per request (bounded payloads). */
const EMBEDDING_BATCH_SIZE = 100;
/** Hard cap on persisted chunks per attachment (defence against runaway docs). */
const MAX_CHUNKS = 400;

/** MIME types the understanding pipeline can extract text from. */
const EXTRACTABLE_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "text/html",
]);

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  // Set only after the caller has proved membership and atomically claimed
  // the job. This prevents an unauthorised request from changing another
  // conversation's processing state through the error handler.
  let claimedAttachmentId: string | null = null;

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
      .select("id, message_id, storage_path, mime_type, size_bytes, processing_status")
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

    // 3b. File types the pipeline never processes (images, audio, video).
    // Reported honestly instead of pretending to process them.
    if (!EXTRACTABLE_MIME_TYPES.has(attachment.mime_type)) {
      await admin
        .from("message_attachments")
        .update({ processing_status: "unsupported", processing_error: null })
      
      .eq("id", attachmentId);
      return json(req, { success: true, message: "unsupported", chunk_count: 0 }, 200);
    }

    // 4. Atomically claim the work. Concurrent calls observe "processing"
    // instead of both extracting and racing on the unique chunk index.
    const { data: claim, error: claimError } = await admin.rpc(
      "claim_attachment_processing",
      { p_attachment_id: attachmentId },
    );
    if (claimError) throw new HttpError(500, "processing_claim_failed");
    if (claim === "ready") {
      return json(req, { success: true, message: "already_processed" }, 200);
    }
    if (claim === "unsupported") {
      return json(req, { success: true, message: "unsupported", chunk_count: 0 }, 200);
    }
    if (claim === "processing") {
      return json(req, { success: true, message: "already_processing", chunk_count: 0 }, 202);
    }
    if (claim !== "claimed") throw new HttpError(500, "processing_claim_invalid");
    claimedAttachmentId = attachmentId;

    // 5. Retrieve file from storage
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

    // 6. Extract text content
    const extractionResult = await extractText(
      filename,
      attachment.mime_type,
      new Uint8Array(await fileData.arrayBuffer()),
    );

    // 7. Chunk the extracted text. PDFs (and any multi-page result) chunk
    // per page so every chunk keeps its true source page number.
    const pages = extractionResult.pages;
    const chunks =
      pages.length > 1
        ? chunkPages(pages, CHUNK_CONFIG)
        : chunkText(extractionResult.text, CHUNK_CONFIG);

    if (chunks.length === 0) {
      // Empty extraction - mark ready with no chunks (truthful, not failed)
      const { error: emptyCompletionError } = await admin.rpc("mark_attachment_processed", {
        p_attachment_id: attachmentId,
        p_chunk_count: 0,
      });
      if (emptyCompletionError) throw new HttpError(500, "processing_completion_failed");
      return json(req, { 
        success: true, 
        message: "empty_extraction",
        chunk_count: 0 
      }, 200);
    }

    // Do not spend embedding quota on content that will never be persisted,
    // and do not silently omit a document tail from searchable context.
    if (chunks.length > MAX_CHUNKS) {
      throw new HttpError(422, "document_too_large_for_processing");
    }

    // 8. Generate labels for chunks (page-aware when pages are known)
    const labels = generateChunkLabels(
      chunks.map((c) => ({ content: c.content, index: c.index })),
      {
        filename: extractionResult.metadata.filename,
        pageCount: extractionResult.metadata.pageCount,
      },
    );

    // 9. Generate embeddings in bounded batches if the key is available.
    // Embedding is best-effort: FTS remains the retrieval fallback whenever
    // it fails, so a provider outage never fails the whole extraction.
    const embeddings: Array<number[] | null> = new Array(chunks.length).fill(null);
    if (OPENAI_API_KEY) {
      for (let start = 0; start < chunks.length; start += EMBEDDING_BATCH_SIZE) {
        const batch = chunks
          .slice(start, start + EMBEDDING_BATCH_SIZE)
          .map((c) => c.content);
        try {
          const vectors = await generateEmbeddings(
            batch,
            OPENAI_API_KEY,
            EMBEDDING_MODEL,
            EMBEDDING_DIMENSION,
          );
          for (let i = 0; i < vectors.length; i++) {
            embeddings[start + i] = vectors[i];
          }
        } catch (embeddingError) {
          console.error(
            "attachment-processor: embedding_generation_failed",
            embeddingError instanceof Error ? embeddingError.message : embeddingError,
          );
          break; // skip remaining batches; FTS covers retrieval
        }      }
    }

    // 10. Persist chunks (bounded), then flip status to ready only on success.
    const records = chunks.map((chunk, i) => ({
      attachment_id: attachmentId,
      chunk_index: chunk.index,
      content: chunk.content,
      label: labels[i] ?? `section ${chunk.index + 1}`,
      token_count: estimateTokenCount(chunk.content),
      page_number: chunk.pageNumber,
      embedding: embeddings[i],
    }));

    const { error: insertErr } = await admin
      .from("attachment_chunks")
      .insert(records);

    if (insertErr) {
      console.error("attachment-processor: chunk_insert_failed", insertErr.message);
      throw new HttpError(500, "chunk_insert_failed");
    }

    // 11. Mark processed — service-role RPC with an ownership guard, so
    // 'ready' can only ever be reached with chunks actually persisted.
    const { error: completionError } = await admin.rpc("mark_attachment_processed", {
      p_attachment_id: attachmentId,
      p_chunk_count: records.length,
    });
    if (completionError) throw new HttpError(500, "processing_completion_failed");

    return json(req, {
      success: true,
      message: "processing_complete",
      chunk_count: records.length,
      metadata: {
        filename: extractionResult.metadata.filename,
        mime_type: extractionResult.metadata.mimeType,
        size_bytes: extractionResult.metadata.sizeBytes,
        extracted_at: extractionResult.metadata.extractedAt,
      },
    }, 200);

  } catch (e) {
    // Best-effort: record the failure on the attachment so the UI can show
    // it. The reason string is bounded and never contains file contents.
    try {
      if (claimedAttachmentId) {
        const reason = e instanceof HttpError ? e.code : "processing_failed";
        await adminClient().rpc("mark_attachment_failed", {
          p_attachment_id: claimedAttachmentId,
          p_reason: reason,
        });
      }
    } catch {
      // status write is best-effort; the original error still surfaces
    }

    if (e instanceof HttpError) {
      return json(req, { error: e.code, detail: e.detail ?? null }, e.status);
    }
    console.error("attachment-processor: internal_error", e);
    return json(req, { error: "internal_error", detail: null }, 500);
  }
});
