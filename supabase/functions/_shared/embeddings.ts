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

/**
 * Generate embeddings for text using OpenAI-compatible API
 * Uses the same provider configuration as the chat completions
 */
export async function generateEmbeddings(
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

  const data: EmbeddingResponse = await response.json();
  
  // Return embeddings in the same order as inputs
  return data.data.map((item) => item.embedding);
}

/**
 * Generate a single embedding for a query string
 */
export async function generateQueryEmbedding(
  query: string,
  apiKey: string,
  model = "text-embedding-3-small",
): Promise<number[]> {
  const embeddings = await generateEmbeddings([query], apiKey, model);
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