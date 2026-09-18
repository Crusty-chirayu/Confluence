/**
 * Ambient types for the Deno `npm:` specifier used by the PDF extraction
 * branch of `supabase/functions/_shared/extract.ts`.
 *
 * tsc (moduleResolution: bundler) cannot resolve `npm:` imports, but the module
 * is imported from vitest tests, so the Node type program needs these
 * declarations to typecheck. Deno resolves the real package and checks against
 * its own types, so **these shapes must mirror `pdfjs-dist@4.8.69`**.
 *
 * They were previously looser than the real package — `workerSrc` was `unknown`
 * and `items` omitted marked-content entries — which let `deno check` fail on
 * code that `tsc --noEmit` accepted. Keep them exact and run both checkers.
 */
declare module "npm:pdfjs-dist@4.8.69" {
  /** A run of text drawn on the page. */
  export interface TextItem {
    str: string;
  }

  /** A marked-content operator. Carries no text of its own. */
  export interface TextMarkedContent {
    type: string;
  }

  export interface TextContent {
    items: Array<TextItem | TextMarkedContent>;
  }

  export interface PDFPageProxy {
    getTextContent(): Promise<TextContent>;
  }

  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  }

  export interface GetDocumentParameters {
    data: Uint8Array;
  }

  export interface LoadingTask {
    promise: Promise<PDFDocumentProxy>;
  }

  /**
   * pdf.js throws `Invalid \`workerSrc\` type` from this setter unless it is
   * given a string, so it cannot be typed loosely without hiding a real error.
   */
  export const GlobalWorkerOptions: { workerSrc: string };

  export function getDocument(params: GetDocumentParameters): LoadingTask;
}
