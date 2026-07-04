import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { StorageAdapter, StoredConcept } from '@memoris/core';
import type { Encounter, Link } from '@memoris/shared';

/**
 * IndexedDB StorageAdapter — the local brain v0 in the browser (docs/ARCHITECTURE.md §7).
 * Tiers 0 & 1 must work offline, which is exactly why the brain is local and not the server.
 */
interface MemorisDB extends DBSchema {
  encounters: { key: string; value: Encounter; indexes: { byConcept: string } };
  concepts: { key: string; value: StoredConcept; indexes: { byKey: string } };
  links: { key: string; value: Link };
}

const DB_NAME = 'memoris';
const DB_VERSION = 1;

export class IdbAdapter implements StorageAdapter {
  private dbp: Promise<IDBPDatabase<MemorisDB>>;

  constructor(name = DB_NAME) {
    this.dbp = openDB<MemorisDB>(name, DB_VERSION, {
      upgrade(db) {
        const enc = db.createObjectStore('encounters', { keyPath: 'id' });
        enc.createIndex('byConcept', 'conceptId');
        const con = db.createObjectStore('concepts', { keyPath: 'id' });
        con.createIndex('byKey', 'key', { unique: false });
        db.createObjectStore('links', { keyPath: 'id' });
      },
    });
  }

  async putEncounter(e: Encounter): Promise<void> {
    await (await this.dbp).put('encounters', e);
  }
  async getEncounter(id: string): Promise<Encounter | undefined> {
    return (await this.dbp).get('encounters', id);
  }
  async listEncounters(): Promise<Encounter[]> {
    return (await this.dbp).getAll('encounters');
  }
  async listEncountersByConcept(conceptId: string): Promise<Encounter[]> {
    return (await this.dbp).getAllFromIndex('encounters', 'byConcept', conceptId);
  }

  async putConcept(c: StoredConcept): Promise<void> {
    await (await this.dbp).put('concepts', c);
  }
  async getConcept(id: string): Promise<StoredConcept | undefined> {
    return (await this.dbp).get('concepts', id);
  }
  async getConceptByKey(key: string): Promise<StoredConcept | undefined> {
    return (await this.dbp).getFromIndex('concepts', 'byKey', key);
  }
  async listConcepts(): Promise<StoredConcept[]> {
    return (await this.dbp).getAll('concepts');
  }
  async deleteConcept(id: string): Promise<void> {
    await (await this.dbp).delete('concepts', id);
  }

  async putLink(l: Link): Promise<void> {
    await (await this.dbp).put('links', l);
  }
  async listLinks(): Promise<Link[]> {
    return (await this.dbp).getAll('links');
  }
  async deleteLink(id: string): Promise<void> {
    await (await this.dbp).delete('links', id);
  }
}
