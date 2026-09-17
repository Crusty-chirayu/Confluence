import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // Deno-runtime tests are executed by `deno test`, not vitest.
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/moderation-fail-closed.test.ts", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Deno-only `npm:` specifier in the shared extract module; vitest
      // imports that module for chunking tests, so remap it to a stub.
      "npm:pdfjs-dist@4.8.69": path.resolve(__dirname, "./tests/stubs/pdfjs.ts"),
    },
  },
});
