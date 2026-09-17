/**
 * Tests for verified attachment citations
 * (`supabase/functions/_shared/citations.ts`).
 *
 * Covers: derivation from retrieved chunks, reference resolution, PDF page
 * propagation, deduplication, and the client-side parser that refuses
 * malformed or invented citations.
 */
import { describe, expect, it } from "vitest";
import {
  buildVerifiedCitations,
  parseCitationText,
  parseCitations,
  serializeCitations,
  MAX_CITATIONS,
} from "../supabase/functions/_shared/citations";
import type { ContextChunk } from "../supabase/functions/_shared/attachment-context";

function chunk(overrides: Partial<ContextChunk> & { attachment_id: string; label: string }): ContextChunk {
  return {
    filename: "report.pdf",
    mime_type: "application/pdf",
    content: "payload",
    ...overrides,
  };
}

describe("parseCitationText", () => {
  it("extracts code-span citations with a page", () => {
    const refs = parseCitationText("As shown in `report.pdf — page 7`, revenue grew.");
    expect(refs).toEqual([{ filename: "report.pdf", label: "page 7", page: 7 }]);
  });

  it("extracts parenthesized page citations", () => {
    const refs = parseCitationText("See report.pdf (page 3) for the budget table.");
    expect(refs).toEqual([{ filename: "report.pdf", label: null, page: 3 }]);
  });

  it("returns nothing for prose that merely mentions a file", () => {
    const refs = parseCitationText("The report.pdf file was uploaded yesterday.");
    expect(refs).toEqual([]);
  });

  it("returns nothing for empty text", () => {
    expect(parseCitationText("")).toEqual([]);
  });
});

describe("buildVerifiedCitations", () => {
  const retrieved: ContextChunk[] = [
    chunk({ attachment_id: "att-1", label: "report.pdf — page 1", page: 1, chunk_index: 0 }),
    chunk({ attachment_id: "att-1", label: "report.pdf — page 7", page: 7, chunk_index: 6 }),
    chunk({
      attachment_id: "att-2",
      filename: "notes.txt",
      mime_type: "text/plain",
      label: "notes.txt — section 1",
      chunk_index: 0,
    }),
  ];

  it("verifies a valid PDF page citation", () => {
    const out = buildVerifiedCitations("`report.pdf — page 7`", retrieved);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      attachment_id: "att-1",
      filename: "report.pdf",
      page: 7,
      chunk_index: 6,
      label: "report.pdf — page 7",
    });
  });

  it("resolves parenthesized page references against retrieved pages", () => {
    const out = buildVerifiedCitations("report.pdf (page 7) confirms it", retrieved);
    expect(out).toHaveLength(1);
    expect(out[0].page).toBe(7);
    expect(out[0].attachment_id).toBe("att-1");
  });

  it("drops citations for pages that were never retrieved", () => {
    const out = buildVerifiedCitations("`report.pdf — page 99`", retrieved);
    expect(out).toEqual([]);
  });

  it("drops citations for attachments that were never retrieved", () => {
    const out = buildVerifiedCitations("`secret.pdf — page 1`", retrieved);
    expect(out).toEqual([]);
  });

  it("resolves a unique non-PDF file mention", () => {
    const out = buildVerifiedCitations("`notes.txt — section 1`", retrieved);
    expect(out).toHaveLength(1);
    expect(out[0].mime_type).toBe("text/plain");
    expect(out[0].page).toBeNull();
  });

  it("deduplicates repeated references to the same chunk", () => {
    const text = "`report.pdf — page 7` and again `report.pdf — page 7`";
    const out = buildVerifiedCitations(text, retrieved);
    expect(out).toHaveLength(1);
  });

  it("supports multiple distinct citations", () => {
    const text = "`report.pdf — page 1` plus `notes.txt — section 1`";
    const out = buildVerifiedCitations(text, retrieved);
    expect(out).toHaveLength(2);
  });

  it("returns nothing when no chunks were retrieved", () => {
    expect(buildVerifiedCitations("`report.pdf — page 7`", [])).toEqual([]);
  });

  it("returns nothing when the text cites nothing", () => {
    expect(buildVerifiedCitations("No citations here.", retrieved)).toEqual([]);
  });
});

describe("serializeCitations / parseCitations", () => {
  it("round-trips a verified citation", () => {
    const [c] = buildVerifiedCitations("`report.pdf — page 7`", [
      chunk({ attachment_id: "att-1", label: "report.pdf — page 7", page: 7, chunk_index: 6 }),
    ]);
    const parsed = parseCitations(JSON.parse(JSON.stringify(serializeCitations([c]))));
    expect(parsed).toEqual([c]);
  });

  it("rejects malformed payloads", () => {
    expect(parseCitations("nope")).toEqual([]);
    expect(parseCitations([null, 42])).toEqual([]);
    expect(parseCitations([{ attachment_id: "", filename: "f", label: "l" }])).toEqual([]);
    expect(parseCitations([{ attachment_id: "a", filename: "f", label: 3 }])).toEqual([]);
  });

  it("bounds the page number and rejects junk", () => {
    const parsed = parseCitations([
      { attachment_id: "a", filename: "f", label: "f — page 1", page: 999999999 },
    ]);
    expect(parsed[0].page).toBeNull();
  });

  it("caps the citation list", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      attachment_id: `a${i}`,
      filename: `f${i}.pdf`,
      label: `page ${i}`,
      page: i + 1,
      chunk_index: i,
      mime_type: "application/pdf",
    }));
    expect(parseCitations(many)).toHaveLength(MAX_CITATIONS);
  });
});
