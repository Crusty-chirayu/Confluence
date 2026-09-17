/**
 * Tests for the real shared embeddings module
 * (`supabase/functions/_shared/embeddings.ts`).
 *
 * Unlike tests/embeddings.test.ts — which mirrors the logic locally — these
 * run against the actual implementation, so response-shape validation,
 * dimension checks and query guards are verified as shipped.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateEmbeddings,
  generateQueryEmbedding,
  EMBEDDING_DIMENSION,
} from "../supabase/functions/_shared/embeddings";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

function okEmbedding(embedding: number[], index = 0) {
  return {
    ok: true,
    json: async () => ({
      data: [{ embedding, index, object: "embedding" }],
      model: "text-embedding-3-small",
      usage: { prompt_tokens: 1, total_tokens: 1 },
    }),
  };
}

describe("generateEmbeddings — response validation", () => {
  it("returns embeddings for a valid response", async () => {
    const vec = new Array(EMBEDDING_DIMENSION).fill(0.5);
    mockFetch.mockResolvedValueOnce(okEmbedding(vec));

    const result = await generateEmbeddings(["hello"], "k");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(vec);
  });

  it("rejects a response whose data array is missing", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ model: "m" }) });
    await expect(generateEmbeddings(["hello"], "k")).rejects.toThrow("embedding_response_invalid");
  });

  it("rejects a response with the wrong number of embeddings", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], model: "m", usage: {} }),
    });
    await expect(generateEmbeddings(["hello"], "k")).rejects.toThrow("embedding_response_invalid");
  });

  it("rejects embeddings with the wrong dimension", async () => {
    mockFetch.mockResolvedValueOnce(okEmbedding([0.1, 0.2, 0.3]));
    await expect(generateEmbeddings(["hello"], "k")).rejects.toThrow("embedding_dimension_mismatch");
  });

  it("rejects non-numeric or non-finite vector entries", async () => {
    const bad = new Array(EMBEDDING_DIMENSION).fill(0) as number[];
    bad[7] = NaN;
    mockFetch.mockResolvedValueOnce(okEmbedding(bad));
    await expect(generateEmbeddings(["hello"], "k")).rejects.toThrow("embedding_dimension_mismatch");
  });

  it("propagates provider failures", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "rate_limited" }) });
    await expect(generateEmbeddings(["hello"], "k")).rejects.toThrow("rate_limited");
  });

  it("returns an empty array without calling the provider for empty input", async () => {
    const result = await generateEmbeddings([], "k");
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("restores input order when the provider returns embeddings out of order", async () => {
    const a = new Array(EMBEDDING_DIMENSION).fill(1);
    const b = new Array(EMBEDDING_DIMENSION).fill(2);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { embedding: b, index: 1, object: "embedding" },
          { embedding: a, index: 0, object: "embedding" },
        ],
        model: "m",
        usage: {},
      }),
    });
    const result = await generateEmbeddings(["first", "second"], "k");
    expect(result[0]).toEqual(a);
    expect(result[1]).toEqual(b);
  });

  it("honours a custom expected dimension", async () => {
    const vec = [0.25, 0.75];
    mockFetch.mockResolvedValueOnce(okEmbedding(vec));
    const result = await generateEmbeddings(["hello"], "k", "m", 2);
    expect(result[0]).toEqual(vec);
  });
});

describe("generateQueryEmbedding", () => {
  it("returns a single validated vector", async () => {
    const vec = new Array(EMBEDDING_DIMENSION).fill(0.9);
    mockFetch.mockResolvedValueOnce(okEmbedding(vec));
    const result = await generateQueryEmbedding("what does the report say?", "k");
    expect(result).toEqual(vec);
  });

  it("rejects an empty query before calling the provider", async () => {
    await expect(generateQueryEmbedding("", "k")).rejects.toThrow("empty_query");
    await expect(generateQueryEmbedding("   ", "k")).rejects.toThrow("empty_query");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("propagates provider failures so callers can fall back to FTS", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    await expect(generateQueryEmbedding("hello", "k")).rejects.toThrow("Network error");
  });
});
