/**
 * Parity between the browser-side and Edge-side "can this file be processed"
 * predicates.
 *
 * `src/lib/attachments.ts` decides whether an upload should trigger the
 * attachment-processor; `supabase/functions/_shared/extract.ts` decides
 * whether the processor will actually extract text. The Edge module cannot be
 * bundled for the browser (it carries a Deno-only `npm:pdfjs-dist` specifier),
 * so the list exists on both sides. These tests import BOTH and fail loudly if
 * they drift — a drift in one direction silently stops processing for a
 * supported format, in the other it queues files the pipeline will reject.
 */
import { describe, expect, it } from "vitest";
import { isExtractableMime } from "../src/lib/attachments";
import { isExtractableMimeType } from "../supabase/functions/_shared/extract";

/** Every MIME type either side mentions, plus the deliberately excluded ones. */
const CANDIDATES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
  // Uploadable but never text-extractable.
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "video/mp4",
  "video/webm",
  // Neither uploadable nor extractable.
  "image/svg+xml",
  "application/octet-stream",
  "application/zip",
  "",
] as const;

describe("extractable MIME parity", () => {
  it("agrees on every candidate type", () => {
    for (const mime of CANDIDATES) {
      expect(isExtractableMime(mime), `client predicate for ${JSON.stringify(mime)}`).toBe(
        isExtractableMimeType(mime),
      );
    }
  });

  it("treats exactly the document formats as extractable", () => {
    const extractable = CANDIDATES.filter((m) => isExtractableMime(m));
    expect(extractable).toEqual([
      "application/pdf",
      "text/plain",
      "text/markdown",
      "text/csv",
      "text/html",
      "application/json",
    ]);
  });

  it("never treats an image, audio or video type as extractable", () => {
    for (const mime of CANDIDATES) {
      if (/^(image|audio|video)\//.test(mime)) {
        expect(isExtractableMime(mime), mime).toBe(false);
        expect(isExtractableMimeType(mime), mime).toBe(false);
      }
    }
  });

  it("normalises case on the client side", () => {
    expect(isExtractableMime("Application/PDF")).toBe(true);
    expect(isExtractableMime("TEXT/CSV")).toBe(true);
  });

  it("rejects an empty or missing MIME type on both sides", () => {
    expect(isExtractableMime("")).toBe(false);
    expect(isExtractableMimeType("")).toBe(false);
  });
});
