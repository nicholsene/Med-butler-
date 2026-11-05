import { BaseRepository, entriesFor, RepositoryError, STORES, type StoreName } from './Repository';
import type { AppData, Meta } from './types';

const DB_NAME = 'medical-butler';
// Version 2 added doctors, visits and marks. Upgrading only adds stores, so existing data stays.
const DB_VERSION = 2;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function openDatabase(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const store of STORES) if (!req.result.objectStoreNames.contains(store)) req.result.createObjectStore(store);
    };
    req.onsuccess = () => {
      // Lets a newer version of the app upgrade the database when it opens in another window.
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('database blocked'));
  });
}

export class IndexedDbRepository extends BaseRepository {
  readonly persistent = true;
  constructor(private db: IDBDatabase) {
    super();
  }

  /** Runs one store operation and resolves when the transaction has committed. */
  private async run<T>(action: string, store: StoreName, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    try {
      const tx = this.db.transaction(store, mode);
      const done = new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      const result = await request(op(tx.objectStore(store)));
      await done;
      return result;
    } catch (cause) {
      throw new RepositoryError(action, cause);
    }
  }

  protected get<T>(store: StoreName, id: string) {
    return this.run(`read ${store}`, store, 'readonly', (s) => s.get(id) as IDBRequest<T | undefined>);
  }
  protected list<T>(store: StoreName) {
    return this.run(`read ${store}`, store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
  }
  protected async put(store: StoreName, id: string, value: unknown) {
    await this.run(`save to ${store}`, store, 'readwrite', (s) => s.put(value, id));
  }
  protected async remove(store: StoreName, id: string) {
    await this.run(`delete from ${store}`, store, 'readwrite', (s) => s.delete(id));
  }
  async deleteAll() {
    try {
      const tx = this.db.transaction([...STORES], 'readwrite');
      const done = new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      for (const store of STORES) tx.objectStore(store).clear();
      await done;
    } catch (cause) {
      throw new RepositoryError('delete all data', cause);
    }
  }
  async replaceAll(data: AppData, meta: Meta) {
    // One transaction across every store, so a failure anywhere rolls the whole swap back.
    const tx = this.db.transaction([...STORES], 'readwrite');
    try {
      const done = new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('replace aborted'));
      });
      try {
        for (const store of STORES) tx.objectStore(store).clear();
        for (const [store, id, value] of entriesFor(data, meta)) tx.objectStore(store).put(value, id);
      } catch (err) {
        tx.abort();
        await done.catch(() => undefined);
        throw err;
      }
      await done;
    } catch (cause) {
      throw new RepositoryError('replace all data', cause);
    }
  }
}
