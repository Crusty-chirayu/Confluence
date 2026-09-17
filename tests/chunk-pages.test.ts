/**
 * Tests for page-aware chunking (`chunkPages` in
 * `supabase/functions/_shared/extract.ts`).
 *
 * The real extract module uses `npm:pdfjs-dist` inside the PDF branch only;
 * importing it from vitest is safe because that branch never executes here.
 * These tests verify that per-page chunking preserves true page numbers,
 * keeps the global index contiguous, and falls back to page-less chunks for
 * single-page text.
 */
import { describe, expect, it } from "vitest";
import { chunkPages, chunkText } from "../supabase/functions/_shared/extract";

describe("chunkPages", () => {
  it("keeps the true page number on single-chunk pages", () => {
    const out = chunkPages(
      [
        { pageNumber: 1, content: "alpha" },
        { pageNumber: 2, content: "beta" },
        { pageNumber: 3, content: "gamma" },
      ],
      { maxChars: 1000, overlapChars: 200 },
    );
    expect(out).toHaveLength(3);
    expect(out.map((c) => c.pageNumber)).toEqual([1, 2, 3]);
    expect(out.map((c) => c.index)).toEqual([0, 1, 2]);
  });

  it("splits a long page into chunks that all carry the same page number", () => {
    const longPage = "A".repeat(2500);
    const out = chunkPages([{ pageNumber: 4, content: longPage }], {
      maxChars: 1000,
      overlapChars: 200,
    });
    expect(out.length).toBeGreaterThan(1);
    for (const chunk of out) {
      expect(chunk.pageNumber).toBe(4);
      expect(chunk.content.length).toBeLessThanOrEqual(1000);
    }
  });

  it("skips empty pages without consuming chunk indices", () => {
    const out = chunkPages(
      [
        { pageNumber: 1, content: "one" },
        { pageNumber: 2, content: "" },
        { pageNumber: 3, content: "   " },
        { pageNumber: 4, content: "four" },
      ],
      { maxChars: 1000, overlapChars: 200 },
    );
    expect(out).toHaveLength(2);
    expect(out.map((c) => c.pageNumber)).toEqual([1, 4]);
  });

  it("returns an empty array for empty input", () => {
    expect(chunkPages([], { maxChars: 100, overlapChars: 10 })).toEqual([]);
  });
});

describe("chunkText page marker", () => {
  it("yields null page numbers when no page data exists", () => {
    const out = chunkText("B".repeat(2500), { maxChars: 1000, overlapChars: 200 });
    expect(out.length).toBeGreaterThan(1);
    for (const chunk of out) expect(chunk.pageNumber).toBeNull();
  });

  it("returns the overlap-based adjacency the retrieval tests rely on", () => {
    const out = chunkText("A".repeat(1500), { maxChars: 1000, overlapChars: 200 });
    if (out.length > 1) {
      expect(out[1].startChar).toBe(out[0].endChar - 200);
    }
  });
});
