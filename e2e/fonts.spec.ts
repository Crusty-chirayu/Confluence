import { test } from "@playwright/test";
import { expect } from "./helpers";

/**
 * §2.3 typography — the families are self-hosted, so the app must never
 * reach for a third-party font CDN.
 *
 * Both assertions are deterministic: the computed font stack is whatever
 * globals.css resolves to, and the origin of every font request is decided
 * by the build (next/font emits them under /_next/static/media).
 */
test("fonts: Inter and JetBrains Mono are served from this origin", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() !== "font") return;
    const { hostname } = new URL(request.url());
    if (hostname !== "127.0.0.1" && hostname !== "localhost") external.push(hostname);
  });

  await page.goto("/");
  await page.waitForLoadState("load");

  // next/font's CSS (which defines --font-inter / --font-mono) can land after
  // first paint in dev, and document.fonts.ready resolves as soon as nothing
  // is *queued* — i.e. potentially before the font CSS arrives. Poll for the
  // computed stack actually resolving instead of trusting a one-shot event.
  await page.waitForFunction(() =>
    getComputedStyle(document.body).fontFamily.toLowerCase().includes("inter"),
  );
  await page.evaluate(() => document.fonts.ready);

  expect(external).toEqual([]);

  const stack = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(stack.toLowerCase()).toContain("inter");

  // The mono stack is declared on <body> alongside --font-sans (the next/font
  // variables it references live there — see globals.css), so read it from the
  // element that actually carries it.
  await page.waitForFunction(() =>
    getComputedStyle(document.body)
      .getPropertyValue("--font-mono")
      .toLowerCase()
      .includes("jetbrains"),
  );
  const mono = await page.evaluate(() =>
    getComputedStyle(document.body).getPropertyValue("--font-mono"),
  );
  expect(mono.toLowerCase()).toContain("jetbrains");
});
