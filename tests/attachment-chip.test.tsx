/**
 * Attachment chip — the UI half of the V3 processing lifecycle (§35).
 *
 * The chip must represent server state truthfully (the composer owns the
 * upload itself; this covers queued / processing / ready / failed /
 * unsupported), announce the terminal states, and offer a retry only where the
 * backend actually supports one — `claim_attachment_processing` re-claims a
 * failed job and `mark_attachment_failed` clears its partial chunks, so a
 * retry is safe and idempotent.
 *
 * Data access is mocked: the unit under test is the rendering and the retry
 * wiring, not Supabase.
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AttachmentChip } from "../src/components/chat/attachment-chip";
import type { AttachmentStatusInfo } from "../src/lib/attachment-status";
import type { MessageAttachment } from "../src/lib/types";
import { expectNoA11yViolations, stubMatchMedia } from "./a11y/helpers";

const attachmentUrl = vi.fn();
const getAttachmentStatus = vi.fn();
const processAttachment = vi.fn();
const pushToast = vi.fn();

vi.mock("@/lib/data/api", () => ({ attachmentUrl: (...a: unknown[]) => attachmentUrl(...a) }));

// Keep the real `isTerminalStatus`: whether a status ends polling is part of
// the behaviour under test, not something to stub.
vi.mock("@/lib/attachment-status", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/attachment-status")>();
  return {
    ...actual,
    getAttachmentStatus: (ids: string[]) => getAttachmentStatus(ids),
  };
});

vi.mock("@/lib/understanding", () => ({
  processAttachment: (id: string) => processAttachment(id),
}));

vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ push: pushToast }) }));

const SIGNED_URL = "https://signed.example/report.pdf";

function attachment(over: Partial<MessageAttachment> = {}): MessageAttachment {
  return {
    id: "att-1",
    message_id: "m1",
    storage_path: "c1/m1/report.pdf",
    mime_type: "application/pdf",
    size_bytes: 2048,
    created_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}

function status(over: Partial<AttachmentStatusInfo> = {}): AttachmentStatusInfo {
  return {
    attachment_id: "att-1",
    status: "ready",
    error: null,
    processed_at: "2026-09-01T00:01:00Z",
    chunk_count: 4,
    ...over,
  };
}

/** Resolve the next status RPC call to a single row (or none) for att-1. */
function statusOnce(info: AttachmentStatusInfo | null) {
  getAttachmentStatus.mockResolvedValueOnce(new Map(info ? [[info.attachment_id, info]] : []));
}

function renderChip(att: MessageAttachment = attachment()) {
  return render(<AttachmentChip attachment={att} />);
}

beforeEach(() => {
  stubMatchMedia();
  attachmentUrl.mockReset();
  getAttachmentStatus.mockReset();
  processAttachment.mockReset();
  pushToast.mockReset();
  attachmentUrl.mockResolvedValue(SIGNED_URL);
  // Default: the attachment is invisible to this caller, so no status row.
  getAttachmentStatus.mockResolvedValue(new Map());
});

afterEach(cleanup);

describe("AttachmentChip — rendering", () => {
  it("links the file name and size to the member-scoped signed URL", async () => {
    renderChip();
    const link = await screen.findByRole("link", { name: /report\.pdf/ });

    expect(link.getAttribute("href")).toBe(SIGNED_URL);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.textContent).toContain("report.pdf");
    expect(link.textContent).toContain("2.0 kB");
  });

  it("does not navigate when no URL could be minted", async () => {
    attachmentUrl.mockResolvedValue(null);
    renderChip();
    const link = await screen.findByRole("link", { name: /report\.pdf/ });

    expect(link.getAttribute("href")).toBe("#");
    await act(async () => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
  });

  it("shows an image thumbnail for image mimes and never polls their status", async () => {
    renderChip(attachment({ mime_type: "image/png", storage_path: "c1/m1/photo.png" }));
    const img = await screen.findByRole("img", { name: "photo.png" });

    expect(img.getAttribute("src")).toBe(SIGNED_URL);
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(getAttachmentStatus).not.toHaveBeenCalled();
  });
});

describe("AttachmentChip — processing lifecycle", () => {
  it("announces processing as a live status", async () => {
    statusOnce(status({ status: "processing", processed_at: null, chunk_count: 0 }));
    renderChip();

    expect((await screen.findByRole("status")).textContent).toBe("Processing");
  });

  it("shows queued without claiming progress", async () => {
    statusOnce(status({ status: "queued", processed_at: null, chunk_count: 0 }));
    renderChip();

    expect((await screen.findByRole("status")).textContent).toBe("queued");
    expect(screen.queryByTestId("attachment-retry")).toBeNull();
  });

  it("reports unsupported types as 'not analyzed' rather than failed", async () => {
    statusOnce(status({ status: "unsupported", chunk_count: 0 }));
    renderChip();

    expect((await screen.findByRole("status")).textContent).toBe("not analyzed");
    expect(screen.queryByTestId("attachment-retry")).toBeNull();
  });

  it("exposes the chunk count on the ready badge", async () => {
    statusOnce(status({ status: "ready", chunk_count: 7 }));
    renderChip();
    const badge = await screen.findByText("Ready for the assistant");

    expect(badge.parentElement?.getAttribute("title")).toBe(
      "Ready — 7 sections available to the assistant",
    );
    expect(screen.queryByTestId("attachment-retry")).toBeNull();
  });

  it("uses the singular for a single chunk", async () => {
    statusOnce(status({ status: "ready", chunk_count: 1 }));
    renderChip();
    const badge = await screen.findByText("Ready for the assistant");

    expect(badge.parentElement?.getAttribute("title")).toBe(
      "Ready — 1 section available to the assistant",
    );
  });

  it("renders no badge at all when the caller cannot see the attachment", async () => {
    renderChip();
    await waitFor(() => expect(getAttachmentStatus).toHaveBeenCalledWith(["att-1"]));

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText("Ready for the assistant")).toBeNull();
    expect(screen.queryByTestId("attachment-retry")).toBeNull();
  });
});

describe("AttachmentChip — failure and retry", () => {
  it("announces the failure and offers a retry named for the file", async () => {
    statusOnce(status({ status: "failed", error: "pdf_extraction_failed", chunk_count: 0 }));
    renderChip();

    expect((await screen.findByRole("status")).textContent).toBe("Processing failed");
    // The accessible name identifies the file; the visible text stays short.
    const retry = screen.getByRole("button", { name: "Retry processing report.pdf" });
    expect(retry.textContent).toBe("Retry");
    expect(retry.getAttribute("type")).toBe("button");
    expect((retry as HTMLButtonElement).disabled).toBe(false);
  });

  it("re-triggers processing and re-reads the status when retried", async () => {
    statusOnce(status({ status: "failed", error: "processing_failed", chunk_count: 0 }));
    renderChip();
    processAttachment.mockResolvedValue({ success: true, message: "processing_complete" });

    await screen.findByRole("status");
    const callsBefore = getAttachmentStatus.mock.calls.length;

    await act(async () => {
      screen.getByTestId("attachment-retry").click();
    });

    expect(processAttachment).toHaveBeenCalledWith("att-1");
    // The lifecycle is re-read from the server rather than assumed.
    await waitFor(() =>
      expect(getAttachmentStatus.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it("surfaces a rejected retry instead of failing silently", async () => {
    statusOnce(status({ status: "failed", error: "processing_failed", chunk_count: 0 }));
    renderChip();
    processAttachment.mockRejectedValue(new Error("rate_limited"));

    await screen.findByRole("status");
    await act(async () => {
      screen.getByTestId("attachment-retry").click();
    });

    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith({
        kind: "error",
        title: "Couldn't retry processing",
        description: "rate_limited",
      }),
    );
  });

  it("never offers a retry for an image, whose status is not tracked", async () => {
    renderChip(attachment({ mime_type: "image/jpeg", storage_path: "c1/m1/photo.jpg" }));
    await screen.findByRole("img", { name: "photo.jpg" });

    expect(screen.queryByTestId("attachment-retry")).toBeNull();
    expect(getAttachmentStatus).not.toHaveBeenCalled();
  });
});

describe("AttachmentChip — accessibility", () => {
  it("has no axe violations in the failed state, including the retry control", async () => {
    statusOnce(status({ status: "failed", error: "processing_failed", chunk_count: 0 }));
    const { container } = renderChip();
    await screen.findByTestId("attachment-retry");

    await expectNoA11yViolations(container);
  });

  it("has no axe violations in the ready state", async () => {
    statusOnce(status({ status: "ready", chunk_count: 3 }));
    const { container } = renderChip();
    await screen.findByText("Ready for the assistant");

    await expectNoA11yViolations(container);
  });
});
