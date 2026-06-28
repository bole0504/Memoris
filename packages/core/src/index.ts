/**
 * @memoris/core — the brain. Framework-agnostic so the same logic runs in the browser
 * extension (IndexedDB), the server, and (later) the Obsidian plugin (sqlite-vec).
 *
 * The golden rule (docs/ARCHITECTURE.md §1): capture surface ≠ brain. This package IS the brain;
 * storage is injected via StorageAdapter so it never couples to one surface.
 */

export * from './types.js';
export * from './adapter.js';
export * from './memory-adapter.js';
export * from './vector.js';
export * from './text.js';
export * from './curation.js';
export * from './review.js';
export * from './markdown.js';
export * from './store.js';
