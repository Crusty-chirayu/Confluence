import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expect, resetDemo, demoSignIn, startAiChat } from "./helpers";

/**
 * Real-browser accessibility audit (axe-core) — §4.
 *
 * Runs axe through Chromium over the public pages and the signed-in app
 * surfaces, in BOTH light and dark themes. We do NOT disable any rule: every
 * WCAG AA violation (including colour-contrast) is surfaced and must be fixed.
 * The `expect` message names the page + theme so a failure is actionable.
 */

const PUBLIC_PAGES = ["/", "/pricing", "/login", "/signup", "/forgot-password", "/changelog"];

// A full axe pass in both themes is a heavy test: it scans seven pages plus
// three app surfaces and waits for entrance animations to settle first.
// The default 30s budget is not enough on a cold dev server.
test.setTimeout(90_000);

/**
 * Wait for framer-motion entrance animations to finish. axe samples computed
 * styles at an instant; scanning mid-entrance measures half-faded text
 * (e.g. opacity 0.22) and reports false colour-contrast violations. The
 * check runs on computed styles (framer-motion animates via WAAPI), but only
 * on *partially* faded visible elements: fully transparent below-the-fold
 * elements are not sampled by axe, so they must not block the scan.
 */
async function settle(page: import("@playwright/test").Page): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const nodes = document.querySelectorAll<HTMLElement>("body *");
        for (const el of nodes) {
          if (el.children.length > 0) continue; // sample leaves + text hosts only
          const { opacity, visibility, display } = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (
            display !== "none" &&
            visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0 &&
            Number.parseFloat(opacity) > 0 &&
            Number.parseFloat(opacity) < 1
          ) {
            return false; // an element is mid-fade — wait for it to finish
          }
        }
        return true;
      },
      undefined,
      { polling: 150, timeout: 10_000 },
    )
    .catch(() => {
      // Scan anyway: a persistent partial opacity is not a violation by
      // itself, and genuine issues will still be reported by axe.
    });
}

async function scan(page: import("@playwright/test").Page, label: string): Promise<void> {
  await settle(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations,
    `${label} — axe violations: ${results.violations
      .map((v) => `${v.id}(${v.nodes.length})`)
      .join(", ")}`,
  ).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`axe: public pages have no violations (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    for (const path of PUBLIC_PAGES) {
      await page.goto(path);
      await page.waitForLoadState("load");
      await scan(page, `${colorScheme} · ${path}`);
    }
  });

  test(`axe: app surfaces have no violations (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await resetDemo(page);
    await demoSignIn(page);

    const surfaces: Array<() => Promise<void>> = [
      async () => {
        await page.goto("/app");
      },
      async () => {
        await page.goto("/app/settings");
      },
      async () => {
        await page.goto("/app");
        await startAiChat(page);
      },
    ];

    for (const go of surfaces) {
      await go();
      await page.waitForLoadState("load");
      await scan(page, `${colorScheme} · ${page.url()}`);
    }
  });
}
