// =====================================================================
// citations — verified attachment citations.
//
// The model is instructed to cite source labels, but instructions are
// not enforcement. This module derives citation metadata ONLY from the
// chunks that were actually retrieved and placed into the prompt, so a
// citation the client renders always maps to a real retrieved chunk.
// Anything the model writes in prose can never mint an attachment id,
// a page number or a label that is not in the retrieved context.
//
// Pure functions only (no Deno.*, no fetch), like attachment-context,
// so the logic is unit-testable under vitest.
// =====================================================================

import type { ContextChunk } from "./attachment-context.ts";

/** A citation reference parsed out of the model's prose. */
export interface ParsedCitation {
  filename: string;
  label: string | null;
  page: number | null;
}

/** A verified citation: strictly derived from a retrieved chunk. */
export interface VerifiedCitation {
  attachment_id: string;
  /** Storage-derived filename of the cited attachment. */
  filename: string;
  /** Source label as rendered in the context block (e.g. "report.pdf — page 7"). */
  label: string;
  /** Page number, only when the source chunk carried one. */
  page: number | null;
  chunk_index: number | null;
  mime_type: string | null;
}

/**
 * Extract `` `filename — label` `` code-span citations and `filename (page N)`
 * mentions from the model's text. Deliberately conservative: only the exact
 * label format the context block teaches the model is recognized, so ordinary
 * prose mentioning a file name does not fabricate references.
 */
export function parseCitationText(text: string): ParsedCitation[] {
  const out: ParsedCitation[] = [];
  if (!text) return out;

  // 1. Code-span form: `report.pdf — page 7` (also accepts ":").
  const span = /`([^`|]+?)\s*[—:-]\s*([^`]+?)`/g;
  for (const m of text.matchAll(span)) {
    const filename = m[1].trim();
    const label = m[2].trim();
    const page = /page\s+(\d{1,4})/i.exec(label);
    out.push({
      filename,
      label: label || null,
      page: page ? Number(page[1]) : null,
    });
  }

  // 2. Parenthesized page form: report.pdf (page 7). The filename token
  // excludes spaces so preceding words ("See report.pdf") are not captured.
  const paren = /([A-Za-z0-9][A-Za-z0-9._'()\[\]-]{0,180}?\.\w{1,8})\s*\(page\s+(\d{1,4})\)/gi;
  for (const m of text.matchAll(paren)) {
    out.push({ filename: m[1].trim(), label: null, page: Number(m[2]) });
  }

  return out;
}

function eq(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** Strip the leading "filename — " prefix from a stored chunk label. */
function bareLabel(label: string): string {
  return label.replace(/^[^—:]{1,300}[—:]\s*/, "").trim();
}

/**
 * Build verified citations by resolving parsed references against the
 * chunks that were actually retrieved. Resolution order:
 *   1. exact label match on the same attachment filename;
 *   2. same filename + matching page (PDF chunking guarantees this);
 *   3. unique filename across the retrieved set (label-less mention).
 * Anything that cannot be resolved to a retrieved chunk is dropped —
 * that is the point.
 */
export function buildVerifiedCitations(
  text: string,
  chunks: ContextChunk[],
): VerifiedCitation[] {
  const refs = parseCitationText(text);
  if (refs.length === 0 || chunks.length === 0) return [];

  const seen = new Set<string>();
  const out: VerifiedCitation[] = [];

  for (const ref of refs) {
    let match: ContextChunk | undefined;

    // 1. exact label on the same file (with or without the filename prefix)
    match = chunks.find(
      (c) => eq(c.filename, ref.filename) && (c.label === ref.label || bareLabel(c.label) === ref.label),
    );
    // 2. same file, same page
    if (!match && ref.page !== null) {
      match = chunks.find(
        (c) =>
          eq(c.filename, ref.filename) &&
          /page\s+\d+/i.test(c.label) &&
          new RegExp(`page\\s+${ref.page}\\b`, "i").test(c.label),
      );
    }
    // 3. unique file mention without a usable label
    if (!match) {
      const sameFile = chunks.filter((c) => eq(c.filename, ref.filename));
      if (sameFile.length === 1 && ref.label === null) match = sameFile[0];
    }

    if (!match) continue;

    const key = `${match.attachment_id}|${match.label}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Prefer the page the chunk was actually extracted from. The stored
    // `page_number` comes from the extractor; a page parsed back out of the
    // label is only a fallback for chunks that predate page tracking.
    const pageFromLabel = /page\s+(\d{1,4})/i.exec(match.label);
    const page =
      typeof match.page === "number" && Number.isInteger(match.page) && match.page >= 1
        ? match.page
        : pageFromLabel
          ? Number(pageFromLabel[1])
          : null;

    out.push({
      attachment_id: match.attachment_id,
      filename: match.filename,
      label: match.label,
      page,
      chunk_index: match.chunk_index ?? null,
      mime_type: match.mime_type ?? null,
    });
  }

  return out;
}

/** Wire format sent to the client (same shape, explicit for the DB jsonb column). */
export type SerializedCitation = VerifiedCitation;

export function serializeCitations(citations: VerifiedCitation[]): SerializedCitation[] {
  return citations.map((c) => ({
    attachment_id: c.attachment_id,
    filename: c.filename,
    label: c.label,
    page: c.page,
    chunk_index: c.chunk_index,
    mime_type: c.mime_type,
  }));
}

/**
 * Client-side validation. Only well-formed citations survive: every field is
 * type-checked, page numbers are bounded, and the list is capped so a hostile
 * payload cannot blow up the renderer.
 */
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
