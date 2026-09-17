import { test } from "@playwright/test";
import { expect, gotoDashboard, composer, messageLog } from "./helpers";

test("continuous typing, first-click selection, rename, pin and current-room deletion", async ({ page }) => {
  await page.goto("/");
  await gotoDashboard(page);
  await page.getByRole("button", { name: "New conversation", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New conversation" });
  await dialog.getByRole("button", { name: /Group room/ }).click();
  const name = dialog.getByLabel("Room name");
  await name.click();
  await name.pressSequentially("Engineering launch room", { delay: 25 });
  await expect(name).toHaveValue("Engineering launch room");
  await expect(name).toBeFocused();
  const topic = dialog.getByLabel("Topic", { exact: true });
  await topic.click();
  await topic.pressSequentially("Coordinate the engineering launch together", { delay: 25 });
  await expect(topic).toHaveValue("Coordinate the engineering launch together");
  await expect(topic).toBeFocused();
  for (const mode of ["Off", "Mention only", "Auto"]) {
    // Click the visible card like a real user: the radio input itself is
    // visually hidden inside its label, so `.check()` cannot click it — and
    // the card's accessible name includes its helper text, so match on that.
    const card = dialog.locator("label", { hasText: mode }).first();
    await card.click();
    await expect(dialog.getByRole("radio", { name: new RegExp(`^${mode}`) })).toBeChecked();
  }
  await dialog.locator("label", { hasText: "Off" }).first().click();
  await expect(dialog.getByRole("radio", { name: /^Off/ })).toBeChecked();
  await dialog.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Engineering launch room", exact: true })).toBeVisible();
  const input = composer(page);
  await input.click();
  await input.pressSequentially("Typing stays focused in the composer", { delay: 25 });
  await expect(input).toHaveValue("Typing stays focused in the composer");
  await expect(input).toBeFocused();
  await input.press("Enter");
  await expect(messageLog(page)).toContainText("Typing stays focused in the composer");
  await page.getByRole("button", { name: "More options for Engineering launch room", exact: true }).click();
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  const rename = page.getByRole("textbox", { name: "Rename Engineering launch room", exact: true });
  await rename.fill("Engineering release room");
  await rename.press("Enter");
  await expect(page.getByRole("heading", { name: "Engineering release room", exact: true })).toBeVisible();
  for (const action of ["Pin to top", "Unpin"]) {
    await page.getByRole("button", { name: "More options for Engineering release room", exact: true }).click();
    await page.getByRole("menuitem", { name: action, exact: true }).click();
  }
  await page.getByRole("button", { name: "More options for Engineering release room", exact: true }).click();
  await page.getByRole("menuitem", { name: "Delete room", exact: true }).click();
  await page.getByRole("dialog", { name: "Delete conversation?" }).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("link", { name: /Engineering release room/ })).toHaveCount(0);
});

test("desktop sidebar toggle and typing-safe shortcut", async ({ page }) => {
  await page.goto("/");
  await gotoDashboard(page);
  await page.keyboard.press("Control+b");
  await expect(page.getByRole("button", { name: "Show sidebar", exact: true })).toBeVisible();
  await page.keyboard.press("Control+b");
  await expect(page.getByRole("button", { name: "New conversation", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Launch war room/ }).click();
  await composer(page).click();
  await page.keyboard.press("Control+b");
  await expect(page.getByRole("button", { name: "New conversation", exact: true })).toBeVisible();
});
