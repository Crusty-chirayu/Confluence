/**
 * Extraction, chunking and labelling — the V3 understanding pipeline.
 *
 * These run against the real shared module
 * (`supabase/functions/_shared/extract.ts`), not a copy of it. The module's
 * only non-Node dependency is the `npm:pdfjs-dist` specifier inside the PDF
 * branch, which `vitest.config.mts` aliases to `tests/stubs/pdfjs.ts`; that
 * stub rejects loudly, so a PDF parse can never be silently faked here.
 *
 * Page-level chunking has its own suite in `tests/chunk-pages.test.ts`.
 */
import { describe, expect, it } from "vitest";
import {
  chunkText,
  estimateTokenCount,
  extractText,
  generateChunkLabels,
  isExtractableMimeType,
  validateFileForExtraction,
  type ChunkConfig,
} from "../supabase/functions/_shared/extract";

const encode = (s: string) => new TextEncoder().encode(s);

describe("validateFileForExtraction", () => {
  it("accepts a valid text file", () => {
    expect(validateFileForExtraction("test.txt", "text/plain", 1024).ok).toBe(true);
  });

  it("accepts every documented extractable format", () => {
    for (const mime of [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/json",
      "text/html",
    ]) {
      expect(validateFileForExtraction("f", mime, 1024).ok, mime).toBe(true);
      expect(isExtractableMimeType(mime), mime).toBe(true);
    }
  });

  it("rejects files over the size limit", () => {
    const result = validateFileForExtraction("large.txt", "text/plain", 11 * 1024 * 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FILE_TOO_LARGE");
  });

  it("rejects unsupported MIME types", () => {
    const result = validateFileForExtraction("test.exe", "application/x-executable", 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNSUPPORTED_MIME_TYPE");
    expect(isExtractableMimeType("application/x-executable")).toBe(false);
  });

  it("rejects unsafe filenames", () => {
    for (const name of ["../etc/passwd", "a/b.txt", "a\\b.txt", "test\0file.txt", ""]) {
      const result = validateFileForExtraction(name, "text/plain", 16);
      expect(result.ok, JSON.stringify(name)).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INVALID_FILENAME");
    }
  });
});

describe("extractText", () => {
  it("extracts plain text with its metadata", async () => {
    const result = await extractText("test.txt", "text/plain", encode("Hello, world!"));

    expect(result.text).toBe("Hello, world!");
    expect(result.pages).toEqual([{ pageNumber: 1, content: "Hello, world!" }]);
    expect(result.metadata.filename).toBe("test.txt");
    expect(result.metadata.mimeType).toBe("text/plain");
    expect(result.metadata.sizeBytes).toBe(13);
    expect(result.metadata.pageCount).toBe(1);
  });

  it("normalizes whitespace and line endings", async () => {
    const result = await extractText(
      "test.txt",
      "text/plain",
      encode("Hello   world\r\n\n\r\nThis is  a test."),
    );
    expect(result.text).toBe("Hello world\n\nThis is a test.");
  });

  it("normalizes page content too, so text and pages describe the same characters", async () => {
    // Chunking runs over `pages`; the prompt and the labels run off `text`.
    // If only one of them were normalized the persisted chunks would carry
    // whitespace the model never saw.
    const result = await extractText("t.md", "text/markdown", encode("a  b\r\n\r\n\r\n\r\nc"));
    expect(result.pages[0].content).toBe(result.text);
    expect(result.pages[0].content).toBe("a b\n\nc");
  });

  it("preserves UTF-8 content", async () => {
    const result = await extractText("test.txt", "text/plain", encode("Hello 世界 🌍"));
    expect(result.text).toBe("Hello 世界 🌍");
  });

  it("falls back to latin1 for invalid UTF-8 instead of throwing", async () => {
    const result = await extractText("legacy.txt", "text/plain", new Uint8Array([0xff, 0xfe, 0x41]));
    expect(result.text.endsWith("A")).toBe(true);
    expect(result.text.length).toBe(3);
  });

  it("handles CSV and JSON as single-page documents", async () => {
    const csv = await extractText("t.csv", "text/csv", encode("name,age\nAlice,30"));
    expect(csv.text).toContain("name,age");
    expect(csv.metadata.pageCount).toBe(1);

    const json = await extractText("t.json", "application/json", encode('{"name":"Alice"}'));
    expect(json.text).toContain("Alice");
  });

  it("reports an empty document as zero pages rather than one blank page", async () => {
    // pageCount means "pages with content" for every format — the PDF branch
    // already skipped blank pages, so a blank text file must agree or the
    // labeller receives a page count that does not describe the chunks.
    const result = await extractText("empty.txt", "text/plain", new Uint8Array(0));
    expect(result.text).toBe("");
    expect(result.pages).toEqual([]);
    expect(result.metadata.pageCount).toBe(0);
  });

  it("reports a whitespace-only document as empty", async () => {
    const result = await extractText("blank.txt", "text/plain", encode("   \n\t\n  "));
    expect(result.text).toBe("");
    expect(result.pages).toEqual([]);
    expect(result.metadata.pageCount).toBe(0);
  });

  it("rejects an unsupported MIME type before touching the buffer", async () => {
    // Validation runs first, so the caller gets the validation message and the
    // buffer is never decoded.
    await expect(extractText("t.exe", "application/x-executable", encode("x"))).rejects.toThrow(
      "Unsupported file type for extraction",
    );
  });

  it("rejects an oversized buffer before extracting", async () => {
    await expect(
      extractText("big.txt", "text/plain", new Uint8Array(11 * 1024 * 1024)),
    ).rejects.toThrow("File too large for extraction");
  });

  it("strips path components from the stored filename", async () => {
    const result = await extractText("notes.txt", "text/plain", encode("hi"));
    expect(result.metadata.filename).toBe("notes.txt");
  });
});

describe("chunkText", () => {
  const config: ChunkConfig = { maxChars: 1000, overlapChars: 200 };

  it("returns a single chunk for short text", () => {
    const chunks = chunkText("Hello, world!", config);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ content: "Hello, world!", index: 0, pageNumber: null });
  });

  it("returns no chunks for empty text", () => {
    expect(chunkText("", config)).toEqual([]);
  });

  it("keeps every chunk within maxChars", () => {
    for (const chunk of chunkText("A".repeat(5000), config)) {
      expect(chunk.content.length).toBeLessThanOrEqual(config.maxChars);
    }
  });

  it("overlaps consecutive chunks by overlapChars", () => {
    const chunks = chunkText("A".repeat(1500), config);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[1].startChar).toBe(chunks[0].endChar - config.overlapChars);
  });

  it("carries no page number, because it was given no pages", () => {
    for (const chunk of chunkText("B".repeat(3000), config)) {
      expect(chunk.pageNumber).toBeNull();
    }
  });

  it("prefers a word boundary over a hard cut", () => {
    const text = `${"word ".repeat(250)}tail`;
    const chunks = chunkText(text, { maxChars: 100, overlapChars: 20 });
    expect(chunks[0].content.endsWith(" ")).toBe(false);
    expect(chunks[0].content.split(" ").every((w) => w === "word")).toBe(true);
  });
});

describe("generateChunkLabels", () => {
  const meta = { filename: "doc.pdf", pageCount: 3 };

  it("uses the extractor's real page number for every chunk", () => {
    const labels = generateChunkLabels(
      [
        { content: "a", index: 0, pageNumber: 1 },
        { content: "b", index: 1, pageNumber: 1 },
        { content: "c", index: 2, pageNumber: 7 },
      ],
      meta,
    );
    expect(labels).toEqual(["page 1", "page 1", "page 7"]);
  });

  it("never invents pages by spreading chunks evenly across pageCount", () => {
    // Regression: 6 chunks over a 3-page document used to be labelled
    // 1,1,2,2,3,3 regardless of where the text actually came from. A document
    // whose content is all on page 1 must say so on every chunk.
    const chunks = Array.from({ length: 6 }, (_, i) => ({
      content: `c${i}`,
      index: i,
      pageNumber: 1,
    }));
    const labels = generateChunkLabels(chunks, { filename: "doc.pdf", pageCount: 3 });
    expect(labels).toEqual(["page 1", "page 1", "page 1", "page 1", "page 1", "page 1"]);
  });

  it("labels a chunk with no observed page as a section, even among paged chunks", () => {
    const labels = generateChunkLabels(
      [
        { content: "a", index: 0, pageNumber: 4 },
        { content: "b", index: 1, pageNumber: null },
        { content: "c", index: 2, pageNumber: 4 },
      ],
      meta,
    );
    expect(labels).toEqual(["page 4", "section 2", "page 4"]);
  });

  it("keeps a page gap honest instead of closing it", () => {
    // Blank pages are dropped during extraction, so page numbers can skip.
    const labels = generateChunkLabels(
      [
        { content: "a", index: 0, pageNumber: 2 },
        { content: "b", index: 1, pageNumber: 9 },
      ],
      { filename: "doc.pdf", pageCount: 2 },
    );
    expect(labels).toEqual(["page 2", "page 9"]);
  });

  it("falls back to section numbering for a chunk with no observed page", () => {
    const labels = generateChunkLabels(
      [
        { content: "a", index: 0, pageNumber: null },
        { content: "b", index: 1 },
      ],
      { filename: "doc.pdf", pageCount: 2 },
    );
    expect(labels).toEqual(["section 1", "section 2"]);
  });

  it("labels a single-page document as page 1", () => {
    const labels = generateChunkLabels([{ content: "a", index: 0 }], {
      filename: "notes.txt",
      pageCount: 1,
    });
    expect(labels).toEqual(["page 1"]);
  });

  it("uses section numbering when no page structure is known at all", () => {
    const labels = generateChunkLabels(
      [
        { content: "a", index: 0 },
        { content: "b", index: 1 },
      ],
      { filename: "notes.txt" },
    );
    expect(labels).toEqual(["section 1", "section 2"]);
  });

  it("ignores a nonsensical page number rather than printing it", () => {
    const labels = generateChunkLabels(
      [
        { content: "a", index: 0, pageNumber: 0 },
        { content: "b", index: 1, pageNumber: -3 },
        { content: "c", index: 2, pageNumber: 1.5 },
      ],
      meta,
    );
    expect(labels).toEqual(["section 1", "section 2", "section 3"]);
  });

  it("returns one label per chunk", () => {
    const chunks = Array.from({ length: 12 }, (_, i) => ({
      content: "x",
      index: i,
      pageNumber: (i % 4) + 1,
    }));
    expect(generateChunkLabels(chunks, meta)).toHaveLength(12);
  });
});

describe("estimateTokenCount", () => {
  it("approximates four characters per token", () => {
    expect(estimateTokenCount("A".repeat(10_000))).toBe(2500);
  });

  it("returns zero for empty text", () => {
    expect(estimateTokenCount("")).toBe(0);
  });

  it("rounds up so a short chunk is never reported as free", () => {
    expect(estimateTokenCount("abc")).toBe(1);
  });
});
