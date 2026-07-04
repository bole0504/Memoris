/**
 * Tiny in-memory TTL + LRU cache. Backs the server-side Tier-0 cache (docs/ARCHITECTURE.md §3):
 * identical questions return instantly without an AI call. Per-process (fine for the single-box
 * MVP); swap for Redis if we ever scale out.
 */
export class TtlCache<V> {
  private map = new Map<string, { v: V; exp: number }>();

  constructor(
    private max = 500,
    private ttlMs = 60 * 60 * 1000,
  ) {}

  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (Date.now() > e.exp) {
      this.map.delete(key);
      return undefined;
    }
    // Touch for LRU recency.
    this.map.delete(key);
    this.map.set(key, e);
    return e.v;
  }

  set(key: string, v: V): void {
    if (this.map.size >= this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { v, exp: Date.now() + this.ttlMs });
  }
}
