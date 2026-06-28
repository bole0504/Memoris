/**
 * @memoris/shared — types shared across extension, server, and dashboard.
 *
 * Source of truth for the four core object types (see docs/ARCHITECTURE.md §8).
 * Obsidian markdown is a *projection* of these, never the other way around.
 */

export * from './model.js';
export * from './api.js';
