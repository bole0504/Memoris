/** Cosine similarity of two equal-length vectors. Returns 0 for degenerate input. */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] as number;
    const y = b[i] as number;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Find the most similar concept vector above a threshold (linear scan — fine at MVP scale). */
export function nearest<T extends { embedding?: number[] }>(
  query: readonly number[],
  items: readonly T[],
  threshold: number,
): { item: T; similarity: number } | undefined {
  let best: { item: T; similarity: number } | undefined;
  for (const item of items) {
    if (!item.embedding || item.embedding.length === 0) continue;
    const similarity = cosineSimilarity(query, item.embedding);
    if (similarity >= threshold && (!best || similarity > best.similarity)) {
      best = { item, similarity };
    }
  }
  return best;
}
