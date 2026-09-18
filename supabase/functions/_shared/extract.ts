// =====================================================================
// extract — V3.0 secure text extraction for Supabase Edge Functions
//
// Handles extraction from common document formats with security constraints:
// - No external dependencies beyond Deno std lib for text formats
// - PDF extraction using pdfjs-dist deno-compatible version
// - Validates file types and sizes
// - Treats extracted content as untrusted data
// - Handles malformed files safely
// - Returns structured extraction results with metadata
// =====================================================================

export interface ExtractionResult {
  text: string;
  pages: Array<{ pageNumber: number; content: string }>;
  metadata: {
    filename: string;
    mimeType: string;
    sizeBytes: number;
    pageCount?: number;
    extractedAt: string;
  };
}

export interface ExtractionError {
  error: string;
 code: string;
  details?: string;
}

/** Maximum file size for extraction (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Supported MIME types for extraction */
const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "text/html",
]);

/**
 * True when the understanding pipeline can extract text from this MIME type.
 *
 * Single source of truth for "is this attachment processable" on the Edge
 * side — the processor must not keep its own copy of the list, or the two
 * drift apart and files get queued for a pipeline that rejects them. The
 * browser-side mirror lives in `src/lib/attachments.ts` and is kept honest
 * by `tests/extractable-mime.test.ts`.
 */
export function isExtractableMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.has(mimeType);
}

/**
 * Validate file metadata before extraction
 */
export function validateFileForExtraction(
  filename: string,
  mimeType: string,
  sizeBytes: number,
): { ok: true } | { ok: false; error: ExtractionError } {
  // Check file size
  if (sizeBytes > MAX_FILE_SIZE) {
    return {
      ok: false,
      error: {
        error: "File too large for extraction",
        code: "FILE_TOO_LARGE",
        details: `Maximum size is ${MAX_FILE_SIZE} bytes, got ${sizeBytes}`,
      },
    };
  }

  // Check MIME type
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    return {
      ok: false,
      error: {
        error: "Unsupported file type for extraction",
        code: "UNSUPPORTED_MIME_TYPE",
        details: `Supported types: ${Array.from(SUPPORTED_MIME_TYPES).join(", ")}`,
      },
    };
  }

  // Validate filename is safe (no path traversal, no control characters)
  if (!isSafeFilename(filename)) {
    return {
      ok: false,
      error: {
        error: "Invalid filename",
        code: "INVALID_FILENAME",
        details: "Filename contains unsafe characters",
      },
    };
  }

  return { ok: true };
}

/**
 * Extract text content from a file buffer
 */
export async function extractText(
  filename: string,
  mimeType: string,
  buffer: Uint8Array,
): Promise<ExtractionResult> {
  const validation = validateFileForExtraction(filename, mimeType, buffer.length);
  if (!validation.ok) {
    throw new Error(validation.error.error);
  }

  let pages: Array<{ pageNumber: number; content: string }> = [];

  switch (mimeType) {
    case "text/plain":
    case "text/markdown":
    case "text/csv":
    case "application/json":
    case "text/html":
      // A text-format document has no page structure; the extractor models it
      // as one page so chunking, labels and page metadata stay uniform across
      // every supported format.
      pages = [{ pageNumber: 1, content: decodeText(buffer) }];
      break;

    case "application/pdf":
      // PDF extraction using pdfjs-dist (Deno-compatible)
      try {
        const pdfData = new Uint8Array(buffer);
        // Load pdfjs dynamically to avoid issues when not needed
        const pdfjs = await import("npm:pdfjs-dist@4.8.69");
        
        // Set worker source to false for Deno compatibility
        pdfjs.GlobalWorkerOptions.workerSrc = false;
        
        const loadingTask = pdfjs.getDocument({ data: pdfData });
        const pdfDocument = await loadingTask.promise;
        
        const pageCount = pdfDocument.numPages;
        const extractedPages: Array<{ pageNumber: number; content: string }> = [];
        
        for (let i = 1; i <= pageCount; i++) {
          const page = await pdfDocument.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: { str?: string }) => item.str ?? "")
            .join(" ")
            .trim();
          
          if (pageText) {
            extractedPages.push({ pageNumber: i, content: pageText });
          }
        }
        
        pages = extractedPages;
      } catch (pdfError) {
        console.error("PDF extraction failed:", pdfError);
        // Never persist a synthetic placeholder as document content: it could
        // later be retrieved and cited as though it came from the PDF. The
        // processor records this as a visible failed state instead.
        throw new Error("pdf_extraction_failed");
      }
      break;

    default:
      throw new Error(`Unsupported MIME type: ${mimeType}`);
  }

  // Normalize every page, then re-derive the whole-document text from the
  // normalized pages. Chunking runs over `pages` while labels, citations and
  // the prompt render from `text`, so the two must describe the same
  // characters — normalizing only `text` left page chunks carrying raw
  // whitespace the document context never showed.
  //
  // Pages that normalize to nothing are dropped so `pageCount` means "pages
  // with content" for every format (the PDF branch already skips blank pages).
  const normalizedPages = pages
    .map((p) => ({ pageNumber: p.pageNumber, content: normalizeText(p.content) }))
    .filter((p) => p.content.length > 0);

  return {
    text: normalizedPages.map((p) => p.content).join("\n\n"),
    pages: normalizedPages,
    metadata: {
      filename: sanitizeFilename(filename),
      mimeType,
      sizeBytes: buffer.length,
      pageCount: normalizedPages.length,
      extractedAt: new Date().toISOString(),
    },
  };
}

/**
 * Decode text from buffer with encoding detection
 */
function decodeText(buffer: Uint8Array): string {
  // Try UTF-8 first
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    return decoder.decode(buffer);
  } catch {
    // Fallback to Latin-1 if UTF-8 fails
    const decoder = new TextDecoder("latin1");
    return decoder.decode(buffer);
  }
}

/**
 * Normalize text content
 */
function normalizeText(text: string): string {
  // Normalize line endings
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Remove excessive whitespace while preserving paragraph structure
  text = text.replace(/[ \t]+/g, " "); // Collapse spaces/tabs
  text = text.replace(/\n{3,}/g, "\n\n"); // Collapse multiple newlines

  // Trim leading/trailing whitespace
  text = text.trim();

  return text;
}

/**
 * Validate filename is safe (no path traversal, no control characters)
 */
function isSafeFilename(filename: string): boolean {
  // Check for null bytes
  if (filename.includes("\0")) return false;

  // Check for path traversal attempts
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return false;
  }

  // Check for control characters
  if (/[\x00-\x1F\x7F]/.test(filename)) return false;

  // Check for reasonable length
  if (filename.length === 0 || filename.length > 255) return false;

  return true;
}

/**
 * Sanitize filename for safe storage/display
 */
function sanitizeFilename(filename: string): string {
  // Remove any path components
  const basename = filename.split(/[\\/]/).pop() || filename;

  // Remove null bytes and control characters
  const clean = basename.replace(/[\x00-\x1F\x7F]/g, "");

  // Limit length
  return clean.slice(0, 255);
}

/**
 * Split text into chunks with overlap for embedding generation.
 *
 * When `pages` is provided the chunks never straddle a page boundary;
 * the returned `pageNumber` says exactly which source page each chunk
 * came from, so citations can carry a verified page number. Without
 * pages the whole text is chunked and `pageNumber` is null.
 */
export interface ChunkConfig {
  maxChars: number;
  overlapChars: number;
}

export function chunkText(
  text: string,
  config: ChunkConfig = { maxChars: 1000, overlapChars: 200 },
): Array<{ content: string; index: number; startChar: number; endChar: number; pageNumber: number | null }> {
  const chunks: Array<{ content: string; index: number; startChar: number; endChar: number; pageNumber: number | null }> = [];

  if (text.length === 0) {
    return chunks;
  }

  if (text.length <= config.maxChars) {
    chunks.push({
      content: text,
      index: 0,
      startChar: 0,
      endChar: text.length,
      pageNumber: null,
    });
    return chunks;
  }

  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + config.maxChars, text.length);
    let chunk = text.slice(start, end);

    // Try to break at word boundary
    if (end < text.length && !/\s/.test(text[end])) {
      const lastSpace = chunk.lastIndexOf(" ");
      if (lastSpace > config.maxChars - config.overlapChars) {
        chunk = chunk.slice(0, lastSpace);
      }
    }

    chunks.push({
      content: chunk.trim(),
      index,
      startChar: start,
      endChar: start + chunk.length,
      pageNumber: null,
    });

    start += chunk.length - config.overlapChars;
    index++;

    if (start >= text.length - config.overlapChars) {
      break;
    }
  }

  return chunks;
}

/**
 * Chunk each page independently so every chunk keeps its true page
 * number. Page text is chunked with the same overlap rules; the global
 * chunk index stays contiguous across pages.
 */
export function chunkPages(
  pages: Array<{ pageNumber: number; content: string }>,
  config: ChunkConfig = { maxChars: 1000, overlapChars: 200 },
): Array<{ content: string; index: number; startChar: number; endChar: number; pageNumber: number | null }> {
  const out: ReturnType<typeof chunkPages> = [];
  for (const page of pages) {
    const pageText = page.content.trim();
    if (!pageText) continue;
    if (pageText.length <= config.maxChars) {
      out.push({
        content: pageText,
        index: out.length,
        startChar: 0,
        endChar: pageText.length,
        pageNumber: page.pageNumber,
      });
      continue;
    }
    const pieces = chunkText(pageText, config);
    for (const piece of pieces) {
      out.push({ ...piece, index: out.length, pageNumber: page.pageNumber });
    }
  }
  return out;
}

/**
 * Generate the source label rendered in the prompt and shown in a citation.
 *
 * A label is only ever a page reference when the extractor actually reported
 * that page for the chunk (`pageNumber`, populated by `chunkPages`). Page
 * numbers are never inferred from a chunk's position: the previous version
 * spread chunks evenly across `pageCount`, which handed the model — and then
 * the user — citations for pages the quoted text did not come from whenever a
 * document had unevenly sized or blank pages.
 *
 * Falls back to `section N` when no chunk carries a page, and to `page 1`
 * for a document the extractor modelled as a single page.
 */
export function generateChunkLabels(
  chunks: Array<{ content: string; index: number; pageNumber?: number | null }>,
  metadata: { filename: string; pageCount?: number },
): string[] {
  const pages = chunks.map((chunk) =>
    typeof chunk.pageNumber === "number" && Number.isInteger(chunk.pageNumber) && chunk.pageNumber >= 1
      ? chunk.pageNumber
      : null,
  );

  if (pages.some((p) => p !== null)) {
    return pages.map((p, i) => (p === null ? `section ${i + 1}` : `page ${p}`));
  }

  // No page structure anywhere in the document.
  if (metadata.pageCount === 1) {
    return chunks.map(() => "page 1");
  }

  return chunks.map((_, i) => `section ${i + 1}`);
}

/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
