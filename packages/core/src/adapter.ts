import type { Encounter, Link } from '@memoris/shared';
import type { StoredConcept } from './types.js';

/**
 * Storage backend the brain runs on. Implementations:
 *  - InMemoryAdapter (tests, and a fallback)
 *  - IndexedDB adapter (browser extension, v0)
 *  - sqlite-vec adapter (Obsidian plugin / desktop, later)
 *
 * All methods are async so a real DB can back them.
 */
export interface StorageAdapter {
  // Encounters — immutable append-only log.
  putEncounter(encounter: Encounter): Promise<void>;
  getEncounter(id: string): Promise<Encounter | undefined>;
  listEncounters(): Promise<Encounter[]>;
  listEncountersByConcept(conceptId: string): Promise<Encounter[]>;

  // Concepts.
  putConcept(concept: StoredConcept): Promise<void>;
  getConcept(id: string): Promise<StoredConcept | undefined>;
  /** Tier-0 exact-match cache lookup. */
  getConceptByKey(key: string): Promise<StoredConcept | undefined>;
  listConcepts(): Promise<StoredConcept[]>;
  deleteConcept(id: string): Promise<void>;

  // Typed links between concepts.
  putLink(link: Link): Promise<void>;
  listLinks(): Promise<Link[]>;
  deleteLink(id: string): Promise<void>;
}
