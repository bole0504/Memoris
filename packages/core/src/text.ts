/**
 * Normalize a selection into a Tier-0 exact-match cache key (docs/ARCHITECTURE.md §2):
 * lowercased, trimmed, internal whitespace collapsed, trailing punctuation stripped.
 * Two selections that differ only in spacing/case/case map to the same key.
 */
export function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,!?;:]+$/u, '')
    .trim();
}

/** Rough word count — used by curation to treat paragraphs differently from terms. */
export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}
