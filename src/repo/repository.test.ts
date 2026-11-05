import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IndexedDbRepository, openDatabase } from './IndexedDbRepository';
import { MemoryRepository } from './MemoryRepository';
import { RepositoryError, type Repository } from './Repository';
import type { LogEntry } from './types';

const log: LogEntry = { id: 'l1', at: 1, chips: ['X'], severity: 'mild', ateRecently: false };

describe.each<[string, () => Promise<Repository>]>([
  ['IndexedDB', async () => new IndexedDbRepository(await openDatabase())],
  ['memory', async () => new MemoryRepository()],
])('%s repository', (_name, make) => {
  it('stores, loads and deletes', async () => {
    const repo = await make();
    await repo.deleteAll();
    await repo.saveLog(log);
    expect(await repo.listLogs()).toEqual([log]);
    await repo.saveTimers({ a: 5 });
    expect((await repo.loadAll()).timers).toEqual({ a: 5 });
    await repo.deleteLog('l1');
    expect(await repo.listLogs()).toEqual([]);
  });
  it('delete all clears every store', async () => {
    const repo = await make();
    await repo.saveLog(log);
    await repo.saveQuestion({ id: 'q', text: 'x', at: 1, cardId: null });
    await repo.saveTimers({ a: 5 });
    await repo.deleteAll();
    expect(await repo.loadAll()).toEqual({
      settings: null,
      timers: {},
      logs: [],
      readings: [],
      ratings: [],
      questions: [],
      prep: [],
      shopping: [],
      doctors: [],
      visits: [],
      marks: [],
    });
    expect(await repo.getMeta()).toEqual({ lastBackupAt: null });
  });
  it('stores doctors, visits and marks', async () => {
    const repo = await make();
    await repo.deleteAll();
    await repo.saveDoctor({ id: 'd', role: 'Primary care' });
    await repo.saveVisit({ id: 'v', doctorId: 'd', at: 1, symptomsDiscussed: ['X'], notes: '', medications: null });
    await repo.saveMark({ id: 'm', topic: 'X', at: 1, doctorId: null });
    const all = await repo.loadAll();
    expect([all.doctors.length, all.visits.length, all.marks.length]).toEqual([1, 1, 1]);
  });
  it('replaceAll swaps every store and sets meta', async () => {
    const repo = await make();
    await repo.deleteAll();
    await repo.saveLog(log);
    await repo.saveQuestion({ id: 'q', text: 'old', at: 1, cardId: null });
    const next = { ...(await repo.loadAll()), logs: [{ ...log, id: 'l2' }], questions: [] };
    await repo.replaceAll(next, { lastBackupAt: 5 });
    const after = await repo.loadAll();
    expect(after.logs.map((l) => l.id)).toEqual(['l2']);
    expect(after.questions).toEqual([]);
    expect(await repo.getMeta()).toEqual({ lastBackupAt: 5 });
  });
  it('a failed replaceAll leaves the old data untouched', async () => {
    const repo = await make();
    await repo.deleteAll();
    await repo.saveLog(log);
    const bad = { ...(await repo.loadAll()), logs: [{ ...log, id: 'l2', chips: (() => undefined) as unknown as string[] }] };
    await expect(repo.replaceAll(bad, { lastBackupAt: 5 })).rejects.toBeDefined();
    expect((await repo.listLogs()).map((l) => l.id)).toEqual(['l1']);
    expect(await repo.getMeta()).toEqual({ lastBackupAt: null });
  });
});

it('upgrading from version 1 keeps existing data and adds the new stores', async () => {
  const name = 'medical-butler';
  await new Promise<void>((resolve, reject) => {
    const del = indexedDB.deleteDatabase(name);
    del.onsuccess = () => resolve();
    del.onerror = () => reject(del.error);
  });
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open(name, 1);
    open.onupgradeneeded = () => {
      for (const s of ['kv', 'logs', 'readings', 'ratings', 'questions', 'prep', 'shopping']) open.result.createObjectStore(s);
    };
    open.onsuccess = () => {
      const tx = open.result.transaction('logs', 'readwrite');
      tx.objectStore('logs').put(log, log.id);
      tx.oncomplete = () => {
        open.result.close();
        resolve();
      };
    };
    open.onerror = () => reject(open.error);
  });
  const repo = new IndexedDbRepository(await openDatabase());
  expect(await repo.listLogs()).toEqual([log]);
  expect(await repo.listDoctors()).toEqual([]);
});

it('wraps storage failures in RepositoryError', async () => {
  const db = await openDatabase();
  db.close();
  await expect(new IndexedDbRepository(db).listLogs()).rejects.toBeInstanceOf(RepositoryError);
});
