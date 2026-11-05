import { IndexedDbRepository, openDatabase } from './IndexedDbRepository';
import { MemoryRepository } from './MemoryRepository';
import type { Repository } from './Repository';

/** Swap point for a future Supabase repository. Falls back to memory, and the UI warns when it does. */
export async function createRepository(): Promise<Repository> {
  try {
    const db = await openDatabase();
    return new IndexedDbRepository(db);
  } catch (err) {
    console.error('IndexedDB unavailable, using memory only', err);
    return new MemoryRepository();
  }
}
