import { test } from "@playwright/test";
import { expect, gotoDashboard, composer, sendMessage, messageLog } from "./helpers";

/**
 * Offline experience (§27).
 *
 * Uses the browser context's offline toggle to drive the real `online` /
 * `offline` events. We verify the banner appears when the connection drops and
 * that the UI reports "Back online" once it is restored. Message sending in
 * demo mode is localStorage-backed, so a send while offline still persists —
 * the product does not pretend otherwise (it shows the offline banner).
 */
test("offline: shows a banner when the connection drops and a status when restored", async ({
  page,
}) => {
  await gotoDashboard(page);
  const context = page.context();

  // Drop the connection — the offline banner should appear.
  await context.setOffline(true);
  await expect(page.getByText(/You're offline/i)).toBeVisible();

  // Demo-mode send still works (local state) while the banner is visible.
  await sendMessage(page, "This stays local while offline");
  await expect(messageLog(page)).toContainText("This stays local while offline");
  await expect(page.getByText(/You're offline/i)).toBeVisible();

  // Restore the connection — a transient "Back online" confirmation appears.
  await context.setOffline(false);
  await expect(page.getByText(/Back online/i)).toBeVisible({ timeout: 5_000 });
});
