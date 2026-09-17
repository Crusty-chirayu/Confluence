// =====================================================================
// embeddings — V3.0 embedding generation for semantic search
//
// Handles text embedding generation using OpenAI-compatible API:
// - Generates embeddings for text chunks
// - Supports batch processing for efficiency
// - Handles provider failures gracefully
// - Returns vector data suitable for pgvector storage
// =====================================================================

export interface EmbeddingRequest {
  input: string | string[];
  model: string;
}

export interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
    object: string;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/** Default embedding dimension for text-embedding-3-small. */
export const EMBEDDING_DIMENSION = 1536;

/**
 * Generate embeddings for text using OpenAI-compatible API
 * Uses the same provider configuration as the chat completions
 *
 * The response is validated before it is trusted: shape, count and
 * dimension are all checked so a malformed provider reply can never be
 * persisted as a vector of the wrong size (pgvector would reject it at
 * best; a silently truncated vector would poison similarity search).
 */
export async function generateEmbeddings(
  inputs: string[],
  apiKey: string,
  model = "text-embedding-3-small",
  expectedDimension = EMBEDDING_DIMENSION,
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

  const data: EmbeddingResponse = await response.json();
  if (!data || !Array.isArray(data.data) || data.data.length !== inputs.length) {
    throw new Error("embedding_response_invalid");
  }
  // Preserve the provider's ordering — callers rely on input-index parity.
  const byIndex = [...data.data].sort((a, b) => a.index - b.index);
  const embeddings = byIndex.map((item) => item?.embedding);
  for (const v of embeddings) {
    if (
      !Array.isArray(v) ||
      v.length !== expectedDimension ||
      v.some((n) => typeof n !== "number" || !Number.isFinite(n))
    ) {
      throw new Error("embedding_dimension_mismatch");
    }
  }
  return embeddings;
}

/**
 * Generate a single embedding for a query string.
 * Empty/whitespace queries are rejected here so callers can rely on the
 * vector being well-formed and can fall back to FTS instead.
 */
export async function generateQueryEmbedding(
  query: string,
  apiKey: string,
  model = "text-embedding-3-small",
  expectedDimension = EMBEDDING_DIMENSION,
): Promise<number[]> {
  const q = query.trim();
  if (!q) throw new Error("empty_query");
  const embeddings = await generateEmbeddings([q], apiKey, model, expectedDimension);
  return embeddings[0];
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
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