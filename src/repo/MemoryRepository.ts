import { BaseRepository, entriesFor, STORES, type StoreName } from './Repository';
import type { AppData, Meta } from './types';

/** Used for tests, and as the last-resort fallback when IndexedDB can't open. */
export class MemoryRepository extends BaseRepository {
  readonly persistent = false;
  private data = new Map<StoreName, Map<string, unknown>>(STORES.map((s) => [s, new Map()]));

  protected async get<T>(store: StoreName, id: string) {
    return this.data.get(store)!.get(id) as T | undefined;
  }
  protected async list<T>(store: StoreName) {
    return [...this.data.get(store)!.values()] as T[];
  }
  protected async put(store: StoreName, id: string, value: unknown) {
    this.data.get(store)!.set(id, structuredClone(value));
  }
  protected async remove(store: StoreName, id: string) {
    this.data.get(store)!.delete(id);
  }
  async deleteAll() {
    for (const m of this.data.values()) m.clear();
  }
  async replaceAll(data: AppData, meta: Meta) {
    // Cloned first, so a value that can't be stored fails before anything is cleared.
    const entries = entriesFor(data, meta).map(([store, id, value]) => [store, id, structuredClone(value)] as const);
    await this.deleteAll();
    for (const [store, id, value] of entries) this.data.get(store)!.set(id, value);
  }
}
