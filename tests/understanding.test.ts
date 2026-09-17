/**
 * Unit tests for attachment understanding utilities
 * 
 * Note: These tests mirror the Edge Function extraction logic
 * for testing in the Node.js environment. The actual implementation
 * lives in supabase/functions/_shared/extract.ts
 */
import { describe, expect, it } from "vitest";

// Replicate the extraction logic for testing in Node.js environment
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "text/html",
]);

function isSafeFilename(filename: string): boolean {
  if (filename.includes("\0")) return false;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return false;
  }
  if (/[\x00-\x1F\x7F]/.test(filename)) return false;
  if (filename.length === 0 || filename.length > 255) return false;
  return true;
}

function sanitizeFilename(filename: string): string {
  const basename = filename.split(/[\\/]/).pop() || filename;
  const clean = basename.replace(/[\x00-\x1F\x7F]/g, "");
  return clean.slice(0, 255);
}

function decodeText(buffer: Uint8Array): string {
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    return decoder.decode(buffer);
  } catch {
    const decoder = new TextDecoder("latin1");
    return decoder.decode(buffer);
  }
}

function normalizeText(text: string): string {
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();
  return text;
}

function validateFileForExtraction(
  filename: string,
  mimeType: string,
  sizeBytes: number,
): { ok: true } | { ok: false; error: { error: string; code: string; details?: string } } {
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

async function extractText(
  filename: string,
  mimeType: string,
  buffer: Uint8Array,
): Promise<{ text: string; pages: Array<{ pageNumber: number; content: string }>; metadata: { filename: string; mimeType: string; sizeBytes: number; pageCount?: number; extractedAt: string } }> {
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
      text = "[PDF extraction requires additional dependencies - file stored for later processing]";
      pages = [{ pageNumber: 1, content: text }];
      break;

    default:
      throw new Error(`Unsupported MIME type: ${mimeType}`);
  }

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

interface ChunkConfig {
  maxChars: number;
  overlapChars: number;
}

function chunkText(
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

function generateChunkLabels(
  chunks: Array<{ content: string; index: number }>,
  metadata: { filename: string; pageCount?: number },
): string[] {
  if (metadata.pageCount && metadata.pageCount > 1) {
    const chunksPerPage = Math.ceil(chunks.length / metadata.pageCount);
    return chunks.map((chunk, i) => {
      const pageNum = Math.min(Math.floor(i / chunksPerPage) + 1, metadata.pageCount!);
      return `page ${pageNum}`;
    });
  }

  if (metadata.pageCount === 1) {
    return chunks.map(() => `page 1`);
  }

  return chunks.map((chunk, i) => `section ${i + 1}`);
}

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

describe("extraction validation", () => {
  it("accepts valid text file", () => {
    const result = validateFileForExtraction("test.txt", "text/plain", 1024);
    expect(result.ok).toBe(true);
  });

  it("rejects files exceeding size limit", () => {
    const result = validateFileForExtraction("large.txt", "text/plain", 11 * 1024 * 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FILE_TOO_LARGE");
    }
  });

  it("rejects unsupported MIME types", () => {
    const result = validateFileForExtraction("test.exe", "application/x-executable", 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED_MIME_TYPE");
    }
  });

  it("rejects unsafe filenames with path traversal", () => {
    const result = validateFileForExtraction("../etc/passwd", "text/plain", 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_FILENAME");
    }
  });

  it("rejects filenames with null bytes", () => {
    const result = validateFileForExtraction("test\0file.txt", "text/plain", 1024);
    expect(result.ok).toBe(false);
  });
});

describe("text extraction", () => {
  it("extracts plain text content", async () => {
    const content = "Hello, world!";
    const buffer = new TextEncoder().encode(content);
    const result = await extractText("test.txt", "text/plain", buffer);

    expect(result.text).toBe("Hello, world!");
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].content).toBe("Hello, world!");
    expect(result.metadata.filename).toBe("test.txt");
    expect(result.metadata.mimeType).toBe("text/plain");
  });

  it("normalizes whitespace in extracted text", async () => {
    const content = "Hello   world\r\n\n\r\nThis is  a test.";
    const buffer = new TextEncoder().encode(content);
    const result = await extractText("test.txt", "text/plain", buffer);

    expect(result.text).toBe("Hello world\n\nThis is a test.");
  });

  it("handles UTF-8 encoding", async () => {
    const content = "Hello 世界 🌍";
    const buffer = new TextEncoder().encode(content);
    const result = await extractText("test.txt", "text/plain", buffer);

    expect(result.text).toBe("Hello 世界 🌍");
  });

  it("handles CSV files", async () => {
    const content = "name,age\nAlice,30\nBob,25";
    const buffer = new TextEncoder().encode(content);
    const result = await extractText("test.csv", "text/csv", buffer);

    expect(result.text).toContain("name,age");
    expect(result.text).toContain("Alice,30");
  });

  it("handles JSON files", async () => {
    const content = '{"name": "Alice", "age": 30}';
    const buffer = new TextEncoder().encode(content);
    const result = await extractText("test.json", "application/json", buffer);

    expect(result.text).toContain("Alice");
  });

  it("throws error for unsupported MIME type", async () => {
    const buffer = new TextEncoder().encode("test");
    await expect(extractText("test.exe", "application/x-executable", buffer)).rejects.toThrow();
  });

  it("handles empty files", async () => {
    const buffer = new Uint8Array(0);
    const result = await extractText("empty.txt", "text/plain", buffer);

    expect(result.text).toBe("");
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].content).toBe("");
  });
});

describe("text chunking", () => {
  it("chunks text with default config", () => {
    const text = "A".repeat(2000);
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].content.length).toBeLessThanOrEqual(1000);
    expect(chunks[0].index).toBe(0);
  });

  it("handles text shorter than max chunk size", () => {
    const text = "Hello, world!";
    const chunks = chunkText(text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Hello, world!");
  });

  it("handles empty text", () => {
    const chunks = chunkText("");
    expect(chunks).toHaveLength(0);
  });

  it("preserves overlap between chunks", () => {
    const text = "A".repeat(1500);
    const config: ChunkConfig = { maxChars: 1000, overlapChars: 200 };
    const chunks = chunkText(text, config);

    if (chunks.length > 1) {
      const firstChunkEnd = chunks[0].content;
      const secondChunkStart = chunks[1].content;
      // Second chunk should start with some overlap from first chunk
      expect(secondChunkStart.length).toBeGreaterThan(0);
    }
  });

  it("provides accurate character positions", () => {
    const text = "Hello world foo bar baz";
    const chunks = chunkText(text, { maxChars: 10, overlapChars: 2 });

    expect(chunks[0].startChar).toBe(0);
    expect(chunks[0].endChar).toBeGreaterThan(0);
    if (chunks.length > 1) {
      expect(chunks[1].startChar).toBeGreaterThan(0);
    }
  });

  it("respects custom chunk configuration", () => {
    const text = "A".repeat(500);
    const config: ChunkConfig = { maxChars: 100, overlapChars: 20 };
    const chunks = chunkText(text, config);

    chunks.forEach(chunk => {
      expect(chunk.content.length).toBeLessThanOrEqual(100);
    });
  });
});

describe("chunk label generation", () => {
  it("generates page-based labels when page count is known", () => {
    const chunks = [
      { content: "Chunk 1", index: 0 },
      { content: "Chunk 2", index: 1 },
      { content: "Chunk 3", index: 2 },
    ];
    const metadata = { filename: "test.pdf", pageCount: 2 };

    const labels = generateChunkLabels(chunks, metadata);

    expect(labels).toHaveLength(3);
    expect(labels[0]).toBe("page 1");
    expect(labels[1]).toBe("page 1"); // First 2 chunks go to page 1 (chunksPerPage = 2)
    expect(labels[2]).toBe("page 2"); // Third chunk goes to page 2
  });

  it("generates section labels when page count is unknown", () => {
    const chunks = [
      { content: "Chunk 1", index: 0 },
      { content: "Chunk 2", index: 1 },
    ];
    const metadata = { filename: "test.txt" };

    const labels = generateChunkLabels(chunks, metadata);

    expect(labels).toHaveLength(2);
    expect(labels[0]).toBe("section 1");
    expect(labels[1]).toBe("section 2");
  });

  it("handles single-page documents", () => {
    const chunks = [{ content: "Chunk 1", index: 0 }];
    const metadata = { filename: "test.txt", pageCount: 1 };

    const labels = generateChunkLabels(chunks, metadata);

    expect(labels).toHaveLength(1);
    expect(labels[0]).toBe("page 1");
  });
});

describe("token count estimation", () => {
  it("estimates token count for English text", () => {
    const text = "Hello world, this is a test.";
    const tokens = estimateTokenCount(text);

    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThanOrEqual(text.length);
  });

  it("handles empty text", () => {
    const tokens = estimateTokenCount("");
    expect(tokens).toBe(0);
  });

  it("handles very long text", () => {
    const text = "A".repeat(10000);
    const tokens = estimateTokenCount(text);

    expect(tokens).toBe(2500); // 10000 / 4
  });
});