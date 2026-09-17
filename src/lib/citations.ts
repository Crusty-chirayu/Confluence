/**
 * Browser-side citation validation.
 *
 * The canonical derivation logic lives in
 * `supabase/functions/_shared/citations.ts` (Edge side). Only the
 * client-safe validation half is duplicated here, deliberately small and
 * covered by tests/citations.test.ts against BOTH copies so they cannot
 * drift apart silently.
 */

export interface VerifiedCitation {
  attachment_id: string;
  filename: string;
  label: string;
  page: number | null;
  chunk_index: number | null;
  mime_type: string | null;
}

export const MAX_CITATIONS = 10;

export function parseCitations(value: unknown): VerifiedCitation[] {
  if (!Array.isArray(value)) return [];
  const out: VerifiedCitation[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const c = raw as Record<string, unknown>;
    if (typeof c.attachment_id !== "string" || c.attachment_id.length === 0) continue;
    if (typeof c.filename !== "string" || c.filename.length === 0) continue;
    if (typeof c.label !== "string" || c.label.length === 0) continue;
    const page =
      typeof c.page === "number" && Number.isInteger(c.page) && c.page >= 1 && c.page <= 100000
        ? c.page
        : null;
    const chunk_index =
      typeof c.chunk_index === "number" && Number.isInteger(c.chunk_index) && c.chunk_index >= 0
        ? c.chunk_index
        : null;
    const mime_type = typeof c.mime_type === "string" ? c.mime_type : null;
    out.push({ attachment_id: c.attachment_id, filename: c.filename, label: c.label, page, chunk_index, mime_type });
    if (out.length >= MAX_CITATIONS) break;
  }
  return out;
}
