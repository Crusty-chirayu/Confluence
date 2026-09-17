import { test } from "@playwright/test";
import {
  expect,
  gotoDashboard,
  startAiChat,
  composer,
  messageLog,
  sendMessage,
  expectAssistantReply,
} from "./helpers";

/**
 * Attachment understanding — UI contract (§35 V3).
 *
 * The Playwright suite runs the app in DEMO MODE (no Supabase, no Edge
 * Functions), so the server-side half of the pipeline (extraction, chunking,
 * embeddings, retrieval, verified citations) cannot execute here. What CAN
 * be covered deterministically is the client contract the UI must hold in
 * every mode:
 *
 *   1. a document attachment survives the send path and renders as a chip
 *      with a truthful size label;
 *   2. no processing status is claimed for a file the demo store never
 *      processed — no spinner, no "ready" badge, no fabricated states;
 *   3. NO citation chips are rendered from model prose alone. Verified
 *      citations are minted only by the orchestrator from retrieved chunks
 *      (server-side); in demo mode none exist, so none may appear. This is
 *      the client-side half of the "no invented sources" guarantee.
 *
 * The full pipeline journey (upload → processing status transitions →
 * retrieval-grounded reply with citations) requires a deployed Supabase
 * project with OPENAI_API_KEY set; see tests/citations.test.ts,
 * tests/attachment-status.test.ts and supabase/migrations for the unit-
 * and integration-level coverage that runs without infrastructure.
 */

test("attachment understanding: a document attachment renders as a chip with its size", async ({
  page,
}) => {
  await gotoDashboard(page);
  await startAiChat(page);

  // A minimal but valid plain-text "document".
  const doc = Buffer.from("Confluence attachment understanding: the launch is scheduled for Tuesday.");

  await page.getByTestId("attachment-input").setInputFiles({
    name: "launch-notes.txt",
    mimeType: "text/plain",
    buffer: doc,
  });

  await composer(page).fill("What does the document say about the launch?");
  await composer(page).press("Enter");

  // The chip shows the document name and a human size label, asserted
  // against the chip itself so the streamed reply can never race the check.
  const chip = messageLog(page).locator("a", { hasText: "launch-notes.txt" }).first();
  await expect(chip).toContainText("launch-notes.txt");
  await expect(chip).toContainText(/B$|kB|MB/);
});

test("attachment understanding: demo mode never fabricates processing status or citations", async ({
  page,
}) => {
  await gotoDashboard(page);
  await startAiChat(page);

  const doc = Buffer.from("Revenue grew 14% quarter over quarter per the finance review.");
  await page.getByTestId("attachment-input").setInputFiles({
    name: "finance-summary.txt",
    mimeType: "text/plain",
    buffer: doc,
  });

  await sendMessage(page, "Summarise the finance summary.");
  await expectAssistantReply(page);

  // Truthful absence of server-verified state in demo mode:
  //  - no "Ready for the assistant" / "Processing failed" announcements;
  //  - no citation group ("Sources") — those are server-verified only.
  await expect(messageLog(page)).not.toContainText("Ready for the assistant");
  await expect(messageLog(page)).not.toContainText("Processing failed");
  await expect(messageLog(page).locator('[data-testid="citation-list"]')).toHaveCount(0);
});

test("attachment understanding: asking about a document yields a normal assistant reply without invented sources", async ({
  page,
}) => {
  await gotoDashboard(page);
  await startAiChat(page);

  const doc = Buffer.from("The staging deploy window is Friday 14:00 UTC. Owner: Marcus.");
  await page.getByTestId("attachment-input").setInputFiles({
    name: "deploy-window.txt",
    mimeType: "text/plain",
    buffer: doc,
  });

  await sendMessage(page, "When is the deploy window?");
  await expectAssistantReply(page);

  // The reply streams in as a normal assistant message. Any future citation
  // chips must come from the verified pipeline — never from the model's own
  // prose — so their absence here is itself the contract under test.
  await expect(messageLog(page)).toContainText("Assistant");
  await expect(messageLog(page).locator('[data-testid="citation-list"]')).toHaveCount(0);
});
