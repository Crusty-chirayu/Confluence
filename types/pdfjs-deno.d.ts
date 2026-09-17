/**
 * Minimal ambient types for the Deno `npm:` specifier used by the PDF
 * extraction branch of `supabase/functions/_shared/extract.ts`.
 *
 * tsc (moduleResolution: bundler) cannot resolve `npm:` imports, but the
 * module is now imported from vitest tests, so the Node type program needs
 * these declarations to typecheck. Deno resolves the real package at
 * runtime; the shapes here only cover what extract.ts consumes.
 */
declare module "npm:pdfjs-dist@4.8.69" {
  export interface TextItem {
    str?: string;
  }

  export interface TextContent {
    items: Array<TextItem>;
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

  export const GlobalWorkerOptions: { workerSrc: unknown };

  export function getDocument(params: GetDocumentParameters): LoadingTask;
}
