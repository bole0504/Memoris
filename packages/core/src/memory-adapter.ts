import type { Encounter, Link } from '@memoris/shared';
import type { StorageAdapter } from './adapter.js';
import type { StoredConcept } from './types.js';

/**
 * In-memory StorageAdapter. Used by tests and as a zero-config fallback. Not persistent.
 */
export class InMemoryAdapter implements StorageAdapter {
  private encounters = new Map<string, Encounter>();
  private concepts = new Map<string, StoredConcept>();
  private links = new Map<string, Link>();

  async putEncounter(encounter: Encounter): Promise<void> {
    this.encounters.set(encounter.id, encounter);
  }

  async getEncounter(id: string): Promise<Encounter | undefined> {
    return this.encounters.get(id);
  }

  async listEncounters(): Promise<Encounter[]> {
    return [...this.encounters.values()];
  }

  async listEncountersByConcept(conceptId: string): Promise<Encounter[]> {
    return [...this.encounters.values()].filter((e) => e.conceptId === conceptId);
  }

  async putConcept(concept: StoredConcept): Promise<void> {
    this.concepts.set(concept.id, concept);
  }

  async getConcept(id: string): Promise<StoredConcept | undefined> {
    return this.concepts.get(id);
  }

  async getConceptByKey(key: string): Promise<StoredConcept | undefined> {
    for (const c of this.concepts.values()) {
      if (c.key === key) return c;
    }
    return undefined;
  }

  async listConcepts(): Promise<StoredConcept[]> {
    return [...this.concepts.values()];
  }

  async deleteConcept(id: string): Promise<void> {
    this.concepts.delete(id);
  }

  async putLink(link: Link): Promise<void> {
    this.links.set(link.id, link);
  }

  async listLinks(): Promise<Link[]> {
    return [...this.links.values()];
  }

  async deleteLink(id: string): Promise<void> {
    this.links.delete(id);
  }
}
