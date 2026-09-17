/**
 * Tests for client-side attachment processing status
 * (`src/lib/attachment-status.ts`).
 *
 * The RPC is mocked: the unit under test is the mapping of server rows to
 * UI-facing status objects, terminal-state detection, and the bounded
 * polling loop that must stop on terminal states, abort signals and
 * attempt exhaustion — never poll forever.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAttachmentStatus,
  isTerminalStatus,
  pollAttachmentStatus,
} from "../src/lib/attachment-status";

const rpc = vi.fn();

vi.mock("../src/lib/supabase/client", () => ({
  getSupabaseBrowser: () => ({
    rpc,
  }),
}));

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    attachment_id: "att-1",
    status: "queued",
    error: null,
    processed_at: null,
    chunk_count: 0,
    ...overrides,
  };
}

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: [], error: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("isTerminalStatus", () => {
  it("treats ready, failed and unsupported as terminal", () => {
    expect(isTerminalStatus("ready")).toBe(true);
    expect(isTerminalStatus("failed")).toBe(true);
    expect(isTerminalStatus("unsupported")).toBe(true);
  });

  it("treats queued and processing as non-terminal", () => {
    expect(isTerminalStatus("queued")).toBe(false);
    expect(isTerminalStatus("processing")).toBe(false);
  });
});

describe("getAttachmentStatus", () => {
  it("maps an RPC row to the UI status shape", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        row({
          status: "ready",
          processed_at: "2026-09-17T00:00:00Z",
          chunk_count: 7,
        }),
      ],
      error: null,
    });
    const map = await getAttachmentStatus(["att-1"]);
    expect(map.get("att-1")).toEqual({
      attachment_id: "att-1",
      status: "ready",
      error: null,
      processed_at: "2026-09-17T00:00:00Z",
      chunk_count: 7,
    });
  });

  it("carries a bounded failure reason only for failed rows", async () => {
    rpc.mockResolvedValueOnce({
      data: [row({ status: "failed", error: "unsupported_mime_type" })],
      error: null,
    });
    const map = await getAttachmentStatus(["att-1"]);
    expect(map.get("att-1")?.status).toBe("failed");
    expect(map.get("att-1")?.error).toBe("unsupported_mime_type");
  });

  it("returns an empty map on RPC errors instead of throwing", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "permission denied" } });
    const map = await getAttachmentStatus(["att-1"]);
    expect(map.size).toBe(0);
  });

  it("returns an empty map without querying for an empty id list", async () => {
    const map = await getAttachmentStatus([]);
    expect(map.size).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("coerces unknown status strings to queued rather than inventing states", async () => {
    rpc.mockResolvedValueOnce({ data: [row({ status: "something_new" })], error: null });
    const map = await getAttachmentStatus(["att-1"]);
    expect(map.get("att-1")?.status).toBe("queued");
  });
});

describe("pollAttachmentStatus", () => {
  it("stops as soon as a terminal status is observed", async () => {
    rpc
      .mockResolvedValueOnce({ data: [row({ status: "processing" })], error: null })
      .mockResolvedValueOnce({ data: [row({ status: "ready", chunk_count: 3 })], error: null });

    const result = await pollAttachmentStatus("att-1", { intervalMs: 1, maxAttempts: 10 });
    expect(result?.status).toBe("ready");
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxAttempts without throwing", async () => {
    rpc.mockResolvedValue({ data: [row({ status: "processing" })], error: null });
    const result = await pollAttachmentStatus("att-1", { intervalMs: 1, maxAttempts: 4 });
    expect(rpc).toHaveBeenCalledTimes(4);
    expect(result?.status).toBe("processing");
  });

  it("respects an aborted signal between attempts", async () => {
    rpc.mockResolvedValue({ data: [row({ status: "processing" })], error: null });
    const signal = { aborted: true };
    const result = await pollAttachmentStatus("att-1", {
      intervalMs: 1,
      maxAttempts: 5,
      signal,
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("returns null when the attachment is invisible to the caller", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const result = await pollAttachmentStatus("att-404", { intervalMs: 1, maxAttempts: 2 });
    expect(result).toBeNull();
  });
});
