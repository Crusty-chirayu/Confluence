import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Next.js 16 blocks cross-origin dev resources by default. The Playwright
  // suite (playwright.config.ts baseURL) and common local setups reach the
  // dev server through these loopback hosts, so allow them explicitly.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
