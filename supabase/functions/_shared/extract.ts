// =====================================================================
// extract — V3.0 secure text extraction for Supabase Edge Functions
//
// Handles extraction from common document formats with security constraints:
// - No external dependencies beyond Deno std lib
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

  let text = "";
  let pages: Array<{ pageNumber: number; content: string }> = [];

  switch (mimeType) {
    case "text/plain":
    case "text/markdown":
    case "text/csv":
    case "application/json":
    case "text/html":
      text = decodeText(buffer);
      pages = [{ pageNumber: 1, content: text }];
      break;

    case "application/pdf":
      // PDF extraction requires external libraries not available in Deno std lib
      // For now, we'll return a placeholder indicating PDF support requires
      // additional dependencies. In production, this would use a library
      // like pdf-parse or call an external extraction service.
      text = "[PDF extraction requires additional dependencies - file stored for later processing]";
      pages = [{ pageNumber: 1, content: text }];
      break;

    default:
      throw new Error(`Unsupported MIME type: ${mimeType}`);
  }

  // Normalize text (remove excessive whitespace, normalize line endings)
  text = normalizeText(text);

  return {
    text,
    pages,
    metadata: {
      filename: sanitizeFilename(filename),
      mimeType,
      sizeBytes: buffer.length,
      pageCount: pages.length,
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
 * Split text into chunks with overlap for embedding generation
 */
export interface ChunkConfig {
  maxChars: number;
  overlapChars: number;
}

export function chunkText(
  text: string,
  config: ChunkConfig = { maxChars: 1000, overlapChars: 200 },
): Array<{ content: string; index: number; startChar: number; endChar: number }> {
  const chunks: Array<{ content: string; index: number; startChar: number; endChar: number }> = [];

  if (text.length === 0) {
    return chunks;
  }

  if (text.length <= config.maxChars) {
    chunks.push({
      content: text,
      index: 0,
      startChar: 0,
      endChar: text.length,
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
 * Generate labels for chunks based on content structure
 */
export function generateChunkLabels(
  chunks: Array<{ content: string; index: number }>,
  metadata: { filename: string; pageCount?: number },
): string[] {
  if (metadata.pageCount && metadata.pageCount > 1) {
    // If we have page information, distribute chunks across pages
    const chunksPerPage = Math.ceil(chunks.length / metadata.pageCount);
    return chunks.map((chunk, i) => {
      const pageNum = Math.min(Math.floor(i / chunksPerPage) + 1, metadata.pageCount!);
      return `page ${pageNum}`;
    });
  }

  // Use page labels even for single-page documents when pageCount is provided
  if (metadata.pageCount === 1) {
    return chunks.map(() => `page 1`);
  }

  // Generic labels for unknown structure
  return chunks.map((chunk, i) => `section ${i + 1}`);
}

/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}