/**
 * Unit tests for embedding generation utilities
 * 
 * Tests the embedding functions for semantic search support.
 * Note: These tests mock the API calls to avoid needing real API keys.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the fetch function for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Local implementation for testing (mirrors the Edge Function code)
async function generateEmbeddings(
  inputs: string[],
  apiKey: string,
  model = "text-embedding-3-small",
): Promise<number[][]> {
  if (inputs.length === 0) {
    return [];
  }

  const url = "https://api.openai.com/v1/embeddings";
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: inputs,
      model,
      encoding_format: "float",
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "embedding_failed" }));
    throw new Error(error.error || "Embedding generation failed");
  }

  const data: { data: Array<{ embedding: number[] }> } = await response.json();
  
  return data.data.map((item) => item.embedding);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vector dimensions must match");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

describe("embedding generation", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("returns empty array for no inputs", async () => {
    const result = await generateEmbeddings([], "test-key");
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("generates embeddings for single input", async () => {
    const mockEmbedding = new Array(1536).fill(0.1);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{
          embedding: mockEmbedding,
          index: 0,
          object: "embedding",
        }],
        model: "text-embedding-3-small",
        usage: { prompt_tokens: 10, total_tokens: 10 },
      }),
    });

    const result = await generateEmbeddings(["test text"], "test-key");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(mockEmbedding);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("generates embeddings for multiple inputs", async () => {
    const mockEmbedding1 = new Array(1536).fill(0.1);
    const mockEmbedding2 = new Array(1536).fill(0.2);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { embedding: mockEmbedding1, index: 0, object: "embedding" },
          { embedding: mockEmbedding2, index: 1, object: "embedding" },
        ],
        model: "text-embedding-3-small",
        usage: { prompt_tokens: 20, total_tokens: 20 },
      }),
    });

    const result = await generateEmbeddings(["text1", "text2"], "test-key");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(mockEmbedding1);
    expect(result[1]).toEqual(mockEmbedding2);
  });

  it("throws error on API failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "api_error" }),
    });

    await expect(generateEmbeddings(["test"], "test-key")).rejects.toThrow("api_error");
  });

  it("throws error on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    await expect(generateEmbeddings(["test"], "test-key")).rejects.toThrow("Network error");
  });

  it("uses correct API endpoint and headers", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ embedding: new Array(1536).fill(0.1), index: 0, object: "embedding" }],
        model: "text-embedding-3-small",
        usage: { prompt_tokens: 10, total_tokens: 10 },
      }),
    });

    await generateEmbeddings(["test"], "test-key");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "Authorization": "Bearer test-key",
        }),
      }),
    );
  });

  it("sends correct request body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ embedding: new Array(1536).fill(0.1), index: 0, object: "embedding" }],
        model: "text-embedding-3-small",
        usage: { prompt_tokens: 10, total_tokens: 10 },
      }),
    });

    await generateEmbeddings(["test text"], "test-key", "custom-model");

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body).toEqual({
      input: ["test text"],
      model: "custom-model",
      encoding_format: "float",
    });
  });
});

describe("cosine similarity", () => {
  it("calculates similarity for identical vectors", () => {
    const v1 = [1, 2, 3];
    const v2 = [1, 2, 3];
    
    const similarity = cosineSimilarity(v1, v2);
    expect(similarity).toBeCloseTo(1.0);
  });

  it("calculates similarity for orthogonal vectors", () => {
    const v1 = [1, 0, 0];
    const v2 = [0, 1, 0];
    
    const similarity = cosineSimilarity(v1, v2);
    expect(similarity).toBeCloseTo(0.0);
  });

  it("calculates similarity for opposite vectors", () => {
    const v1 = [1, 2, 3];
    const v2 = [-1, -2, -3];
    
    const similarity = cosineSimilarity(v1, v2);
    expect(similarity).toBeCloseTo(-1.0);
  });

  it("throws error for mismatched dimensions", () => {
    const v1 = [1, 2, 3];
    const v2 = [1, 2];
    
    expect(() => cosineSimilarity(v1, v2)).toThrow("Vector dimensions must match");
  });

  it("handles zero vectors", () => {
    const v1 = [0, 0, 0];
    const v2 = [1, 2, 3];
    
    const similarity = cosineSimilarity(v1, v2);
    expect(similarity).toBe(0);
  });

  it("handles realistic vectors", () => {
    const v1 = [0.5, 0.8, 0.3];
    const v2 = [0.6, 0.7, 0.4];
    
    const similarity = cosineSimilarity(v1, v2);
    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThanOrEqual(1);
  });
});