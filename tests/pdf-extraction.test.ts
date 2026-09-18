/**
 * Integration test for the PDF branch of `extractText` — the only branch that
 * loads a real third-party runtime, and the one the vitest suite has to stub
 * (`tests/stubs/pdfjs.ts`) because pdf.js ships as a Deno `npm:` specifier.
 *
 * It exists because the stub cannot catch a broken pdf.js initialization: the
 * worker source was once assigned `false`, which the real package rejects with
 * "Invalid workerSrc type", so every PDF failed extraction while the stubbed
 * tests stayed green. These assertions run against the real library.
 *
 * Assertions come from `node:assert` rather than `jsr:@std/assert` (used by
 * `moderation-fail-closed.test.ts`) so this test needs no registry beyond npm
 * and runs wherever Deno does.
 *
 *   deno test --allow-read --allow-env --allow-net tests/pdf-extraction.test.ts
 */
import assert from "node:assert/strict";
import {
  chunkPages,
  extractText,
  generateChunkLabels,
} from "../supabase/functions/_shared/extract.ts";

/** Escape the three characters that are special inside a PDF literal string. */
function escapePdfString(text: string): string {
  return text.replace(/[\\()]/g, (c) => `\\${c}`);
}

/**
 * Lay text out the way a real page does: one text-showing operator per visual
 * line. A single operator carrying a whole paragraph runs off the right edge of
 * the MediaBox, and pdf.js only reports the glyphs that fit on the page.
 */
function contentStream(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > 72 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length === 0) return "";

  const ops = lines
    .map((l, i) => `${i === 0 ? "72 720 Td" : "0 -14 Td"} (${escapePdfString(l)}) Tj`)
    .join("\n");
  return `BT /F1 12 Tf\n${ops}\nET`;
}

/**
 * Assemble a valid PDF with one page per entry of `pages`, using the base-14
 * Helvetica font so no font file is needed. Byte offsets for the xref table are
 * computed as the objects are appended; a blank entry produces a page with no
 * text operators, which is what a real scanned-but-empty page looks like to the
 * extractor.
 */
function buildPdf(pages: string[]): Uint8Array {
  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  const firstPageId = 4;
  const objectCount = firstPageId + 2 * pages.length;

  const objects = new Map<number, string>();
  objects.set(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  objects.set(
    pagesId,
    `<< /Type /Pages /Kids [${pages
      .map((_, i) => `${firstPageId + 2 * i} 0 R`)
      .join(" ")}] /Count ${pages.length} >>`,
  );
  objects.set(fontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pages.forEach((text, i) => {
    const pageId = firstPageId + 2 * i;
    const contentId = pageId + 1;
    objects.set(
      pageId,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] ` +
        `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    // An empty `text` yields a stream with no text-showing operator at all.
    const stream = contentStream(text);
    objects.set(
      contentId,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  });

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objectCount; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }
  const startxref = out.length;
  out += `xref\n0 ${objectCount}\n0000000000 65535 f \n`;
  for (let id = 1; id < objectCount; id++) {
    out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objectCount} /Root ${catalogId} 0 R >>\n`;
  out += `startxref\n${startxref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

Deno.test("extractText reads a real PDF and keeps true page numbers", async () => {
  // Page 2 is deliberately blank so the skipped page still advances the count.
  const result = await extractText(
    "notes.pdf",
    "application/pdf",
    buildPdf(["Quarterly revenue summary", "", "Risk register excerpt"]),
  );

  assert.equal(result.metadata.mimeType, "application/pdf");
  assert.equal(result.metadata.filename, "notes.pdf");
  // `pageCount` means "pages with content" for every format, so the blank page
  // does not count. That is why labels must never be derived from it: a chunk
  // can legitimately cite a page number greater than `pageCount`.
  assert.equal(result.metadata.pageCount, 2);
  assert.deepEqual(result.pages, [
    { pageNumber: 1, content: "Quarterly revenue summary" },
    { pageNumber: 3, content: "Risk register excerpt" },
  ]);
  assert.equal(result.text, "Quarterly revenue summary\n\nRisk register excerpt");
});

Deno.test("chunks from a real PDF cite the page they came from", async () => {
  // The blank page 2 is the case that used to produce invented citations: with
  // two chunks and `pageCount` derived from the number of non-empty pages, the
  // fallback arithmetic labelled this chunk "page 2" when the words are on 3.
  const result = await extractText(
    "notes.pdf",
    "application/pdf",
    buildPdf(["Quarterly revenue summary", "", "Risk register excerpt"]),
  );

  const chunks = chunkPages(result.pages, { maxChars: 4000, overlapChars: 800 });
  assert.deepEqual(
    chunks.map((c) => c.pageNumber),
    [1, 3],
  );
  assert.deepEqual(
    generateChunkLabels(chunks, {
      filename: "notes.pdf",
      pageCount: result.metadata.pageCount,
    }),
    ["page 1", "page 3"],
  );
});

Deno.test("a long page is split across chunks that all cite it", async () => {
  const longLine = "Lorem ipsum dolor sit amet consectetur ";
  const result = await extractText(
    "long.pdf",
    "application/pdf",
    buildPdf([longLine.repeat(60).trim()]),
  );

  const chunks = chunkPages(result.pages, { maxChars: 600, overlapChars: 120 });
  assert.ok(chunks.length > 1, "expected the long page to split");
  assert.ok(
    chunks.every((c) => c.pageNumber === 1),
    "every chunk must cite the page it came from",
  );
  // Overlap is a prefix of the following chunk, not a rewrite of the source.
  assert.ok(chunks[1].content.startsWith(chunks[0].content.slice(-120)));
});

Deno.test("bytes that are not a PDF fail closed", async () => {
  await assert.rejects(
    () =>
      extractText(
        "notes.pdf",
        "application/pdf",
        new TextEncoder().encode("this is plainly not a pdf document"),
      ),
    /pdf_extraction_failed/,
  );
});
