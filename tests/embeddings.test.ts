/**
 * Embedding request wire format and vector maths.
 *
 * Runs against the real shared module (`supabase/functions/_shared/embeddings.ts`)
 * with `fetch` stubbed — no API key, no network. Response-shape and dimension
 * validation is covered separately in `tests/embeddings-validation.test.ts`;
 * this file covers what is sent, how failures propagate, and `cosineSimilarity`
 * (the reference for the `<=>` operator the retrieval SQL uses — in production
 * similarity is computed by pgvector, not here).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMBEDDING_DIMENSION,
  cosineSimilarity,
  generateEmbeddings,
  generateQueryEmbedding,
} from "../supabase/functions/_shared/embeddings";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

function vector(fill: number, dim = EMBEDDING_DIMENSION): number[] {
  return new Array(dim).fill(fill);
}

function okResponse(data: Array<{ embedding: number[]; index: number }>) {
  return {
    ok: true,
    json: async () => ({
      data: data.map((d) => ({ ...d, object: "embedding" })),
      model: "text-embedding-3-small",
      usage: { prompt_tokens: 1, total_tokens: 1 },
    }),
  };
}

describe("generateEmbeddings — request", () => {
  it("does not call the provider for an empty batch", async () => {
    await expect(generateEmbeddings([], "k")).resolves.toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("posts to the OpenAI-compatible embeddings endpoint with a bearer key", async () => {
    mockFetch.mockResolvedValueOnce(okResponse([{ embedding: vector(0.1), index: 0 }]));

    await generateEmbeddings(["test text"], "test-key");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        }),
      }),
    );
  });

  it("sends the batch, model and float encoding in the body", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse([
        { embedding: vector(0.1), index: 0 },
        { embedding: vector(0.2), index: 1 },
      ]),
    );

    await generateEmbeddings(["text1", "text2"], "k", "custom-model");

    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      input: ["text1", "text2"],
      model: "custom-model",
      encoding_format: "float",
    });
  });

  it("defaults to text-embedding-3-small", async () => {
    mockFetch.mockResolvedValueOnce(okResponse([{ embedding: vector(0.1), index: 0 }]));
    await generateEmbeddings(["x"], "k");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).model).toBe("text-embedding-3-small");
  });

  it("returns one vector per input, in input order", async () => {
    const a = vector(0.1);
    const b = vector(0.2);
    mockFetch.mockResolvedValueOnce(
      okResponse([
        { embedding: a, index: 0 },
        { embedding: b, index: 1 },
      ]),
    );

    const result = await generateEmbeddings(["first", "second"], "k");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(a);
    expect(result[1]).toEqual(b);
  });
});

describe("generateEmbeddings — failures", () => {
  it("surfaces the provider's error body", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "api_error" }) });
    await expect(generateEmbeddings(["test"], "k")).rejects.toThrow("api_error");
  });

  it("falls back to a stable code when the error body is unreadable", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error("not json");
      },
    });
    await expect(generateEmbeddings(["test"], "k")).rejects.toThrow("embedding_failed");
  });

  it("propagates a network failure so the caller can degrade to FTS", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    await expect(generateEmbeddings(["test"], "k")).rejects.toThrow("Network error");
  });
});

describe("generateQueryEmbedding", () => {
  it("trims the query and returns a single vector", async () => {
    const vec = vector(0.9);
    mockFetch.mockResolvedValueOnce(okResponse([{ embedding: vec, index: 0 }]));

    await expect(generateQueryEmbedding("  what does the report say?  ", "k")).resolves.toEqual(vec);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).input).toEqual([
      "what does the report say?",
    ]);
  });

  it("rejects a blank query without calling the provider", async () => {
    await expect(generateQueryEmbedding("   ", "k")).rejects.toThrow("empty_query");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("cosineSimilarity", () => {
  it("is 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("is 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0);
  });

  it("is -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1);
  });

  it("is scale invariant", () => {
    expect(cosineSimilarity([0.5, 0.5], [100, 100])).toBeCloseTo(1);
  });

  it("returns 0 rather than NaN for a zero vector", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("refuses mismatched dimensions instead of silently truncating", () => {
    expect(() => cosineSimilarity([1, 2, 3], [1, 2])).toThrow("Vector dimensions must match");
  });

  it("stays within [-1, 1] for realistic embeddings", () => {
    const score = cosineSimilarity([0.5, 0.8, 0.3], [0.6, 0.7, 0.4]);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
