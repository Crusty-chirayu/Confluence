/**
 * Attachment processing status (client).
 *
 * Single source of truth for the lifecycle the UI renders:
 *   unsupported -> (terminal; never processed)
 *   queued -> processing -> ready | failed
 *
 * `getAttachmentStatus` reads the `get_attachment_processing_status` RPC
 * (member-scoped server-side). Polling is bounded: at most `maxAttempts`
 * checks with a fixed interval, then it stops rather than polling forever.
 */

import { getSupabaseBrowser } from "@/lib/supabase/client";

export type ProcessingStatus =
  | "unsupported"
  | "queued"
  | "processing"
  | "ready"
  | "failed";

export interface AttachmentStatusInfo {
  attachment_id: string;
  status: ProcessingStatus;
  /** Short, safe reason — only present for failed. */
  error: string | null;
  processed_at: string | null;
  chunk_count: number;
}

const TERMINAL: ReadonlySet<ProcessingStatus> = new Set(["ready", "failed", "unsupported"]);

export function isTerminalStatus(status: ProcessingStatus): boolean {
  return TERMINAL.has(status);
}

/**
 * Fetch processing status for a set of attachments. Returns a map keyed by
 * attachment id; missing ids mean the caller cannot see that attachment.
 */
export async function getAttachmentStatus(
  attachmentIds: string[],
): Promise<Map<string, AttachmentStatusInfo>> {
  const out = new Map<string, AttachmentStatusInfo>();
  if (attachmentIds.length === 0) return out;
  const supa = getSupabaseBrowser();
  if (!supa) return out;

  const { data, error } = await supa.rpc("get_attachment_processing_status", {
    p_attachment_ids: attachmentIds,
  });
  if (error) return out;

  for (const row of data ?? []) {
    const r = row as {
      attachment_id: string;
      status: string;
      error: string | null;
      processed_at: string | null;
      chunk_count: number;
    };
    out.set(r.attachment_id, {
      attachment_id: r.attachment_id,
      status: (TERMINAL.has(r.status as ProcessingStatus) || r.status === "queued" || r.status === "processing"
        ? r.status
        : "queued") as ProcessingStatus,
      error: r.error,
      processed_at: r.processed_at,
      chunk_count: r.chunk_count ?? 0,
    });
  }
  return out;
}

export interface PollOptions {
  /** ms between checks (default 2500). */
  intervalMs?: number;
  /** Max checks before giving up (default 12 => ~30s). Bounded by design. */
  maxAttempts?: number;
  signal?: { aborted: boolean };
}

/**
 * Poll until the attachment reaches a terminal status or attempts run out.
 * Resolves with the last observed status; never throws for a poll that
 * simply timed out.
 */
export async function pollAttachmentStatus(
  attachmentId: string,
  opts: PollOptions = {},
): Promise<AttachmentStatusInfo | null> {
  const interval = opts.intervalMs ?? 2500;
  const maxAttempts = opts.maxAttempts ?? 12;
  let last: AttachmentStatusInfo | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (opts.signal?.aborted) return last;
    const map = await getAttachmentStatus([attachmentId]);
    last = map.get(attachmentId) ?? null;
    if (last && isTerminalStatus(last.status)) return last;
    await new Promise((r) => setTimeout(r, interval));
  }
  return last;
}
