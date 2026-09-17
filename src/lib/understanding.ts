/**
 * Client-side attachment understanding utilities
 * 
 * Provides functions for triggering attachment processing and
 * integrating attachment context into AI requests.
 */

import { SUPABASE_URL } from "@/lib/env";
import { getSupabaseBrowser } from "@/lib/supabase/client";

/**
 * Trigger processing of an attachment via the attachment-processor Edge Function
 * This is called after a file is uploaded to initiate text extraction and chunking
 * Note: The processor requires proper user authentication and conversation membership
 */
export async function processAttachment(attachmentId: string): Promise<{
  success: boolean;
  message: string;
  chunk_count?: number;
  metadata?: {
    filename: string;
    mime_type: string;
    size_bytes: number;
    extracted_at: string;
  };
}> {
  const supa = getSupabaseBrowser();
  if (!supa) {
    throw new Error("Supabase client not available");
  }

  const { data: { session } } = await supa.auth.getSession();
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
    const error = await response.json().catch(() => ({ error: "processing_failed" }));
    throw new Error(error.error || "Attachment processing failed");
  }

  return response.json();
}

/**
 * Check if an attachment has been processed (has chunks)
 */
export async function isAttachmentProcessed(attachmentId: string): Promise<boolean> {
  const supa = getSupabaseBrowser();
  if (!supa) return false;

  const { data, error } = await supa
    .from("attachment_chunks")
    .select("id")
    .eq("attachment_id", attachmentId)
    .limit(1);

  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/**
 * Get attachment context for a conversation (used by AI orchestrator)
 * This function would be called from the Edge Function, not client-side
 */
export async function getConversationAttachmentContext(conversationId: string): Promise<{
  attachments: Array<{
    id: string;
    filename: string;
    mime_type: string;
    chunk_count: number;
  }>;
}> {
  const supa = getSupabaseBrowser();
  if (!supa) {
    return { attachments: [] };
  }

  const { data, error } = await supa.rpc("get_attachment_context", {
    p_conversation_id: conversationId,
  });

  if (error) {
    console.error("Failed to get attachment context:", error);
    return { attachments: [] };
  }

  return { attachments: data || [] };
}