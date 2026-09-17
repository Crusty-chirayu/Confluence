/**
 * Node-side stand-in for `npm:pdfjs-dist@4.8.69` (Deno-only import in
 * supabase/functions/_shared/extract.ts). Mapped via `resolve.alias` in
 * vitest.config.mts so the shared extraction module can be imported from
 * vitest. The PDF branch is never exercised under vitest; if it ever were,
 * this stub fails loudly instead of pretending to parse a PDF.
 */

export interface TextItem {
  str?: string;
}

export const GlobalWorkerOptions = { workerSrc: null as unknown };

export function getDocument(): { promise: Promise<never> } {
  return {
    promise: Promise.reject(
      new Error("PDF extraction is not available in the Node test environment"),
    ),
  };
}
