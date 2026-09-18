/**
 * Client-side entry point for the attachment understanding pipeline (§35 V3).
 *
 * The pipeline itself runs server-side: `attachment-processor` extracts,
 * chunks and embeds; `ai-orchestrator` retrieves and grounds the reply. The
 * browser's only job is to start processing after a durable upload — the
 * resulting lifecycle is read back through the member-scoped status RPC in
 * `@/lib/attachment-status`, never inferred here.
 */

import { SUPABASE_URL } from "@/lib/env";
import { getSupabaseBrowser } from "@/lib/supabase/client";

/** Response shape returned by the attachment-processor Edge Function. */
export interface ProcessAttachmentResult {
  success: boolean;
  /**
   * Outcome of the call. `processing_complete` and `empty_extraction` are
   * terminal successes; `already_processed`, `already_processing` and
   * `unsupported` mean no work was needed; anything else is a rejection.
   */
  message: string;
  chunk_count?: number;
  metadata?: {
    filename: string;
    mime_type: string;
    size_bytes: number;
    extracted_at: string;
  };
}

/**
 * Trigger processing of an attachment via the attachment-processor Edge
 * Function. Called after a file has been durably uploaded.
 *
 * Requires the caller's own session: the function re-verifies the JWT and
 * conversation membership server-side, and atomically claims the job, so a
 * duplicate or concurrent call is a no-op rather than a second extraction.
 *
 * Throws when the client is unavailable, the caller is unauthenticated, or
 * the function rejects the request — callers decide whether that is fatal
 * (the upload itself already succeeded).
 */
export async function processAttachment(
  attachmentId: string,
): Promise<ProcessAttachmentResult> {
  const supa = getSupabaseBrowser();
  if (!supa) {
    throw new Error("Supabase client not available");
  }

  const {
    data: { session },
  } = await supa.auth.getSession();
  if (!session) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/attachment-processor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ attachment_id: attachmentId }),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(error?.error || "Attachment processing failed");
  }

  return (await response.json()) as ProcessAttachmentResult;
}
