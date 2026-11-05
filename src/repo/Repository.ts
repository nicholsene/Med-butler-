import type { StepRating } from '../logic/ratings';
import type { AppData, Doctor, LogEntry, Meta, PrepItemState, ReadingEntry, SavedQuestion, Settings, ShoppingItem, Timers, ToldMark, Visit } from './types';

/** Every read and write goes through here, so a Supabase version can replace IndexedDB later. */
export interface Repository {
  /** False when data lives only in memory and will be lost when the app closes. */
  readonly persistent: boolean;
  getSettings(): Promise<Settings | null>;
  saveSettings(settings: Settings): Promise<void>;
  getTimers(): Promise<Timers>;
  saveTimers(timers: Timers): Promise<void>;
  listLogs(): Promise<LogEntry[]>;
  saveLog(entry: LogEntry): Promise<void>;
  deleteLog(id: string): Promise<void>;
  listReadings(): Promise<ReadingEntry[]>;
  saveReading(entry: ReadingEntry): Promise<void>;
  listRatings(): Promise<StepRating[]>;
  saveRating(rating: StepRating): Promise<void>;
  deleteRating(id: string): Promise<void>;
  listQuestions(): Promise<SavedQuestion[]>;
  saveQuestion(question: SavedQuestion): Promise<void>;
  deleteQuestion(id: string): Promise<void>;
  listPrep(): Promise<PrepItemState[]>;
  savePrep(item: PrepItemState): Promise<void>;
  deletePrep(id: string): Promise<void>;
  listShopping(): Promise<ShoppingItem[]>;
  saveShopping(item: ShoppingItem): Promise<void>;
  deleteShopping(id: string): Promise<void>;
  listDoctors(): Promise<Doctor[]>;
  saveDoctor(doctor: Doctor): Promise<void>;
  deleteDoctor(id: string): Promise<void>;
  listVisits(): Promise<Visit[]>;
  saveVisit(visit: Visit): Promise<void>;
  deleteVisit(id: string): Promise<void>;
  listMarks(): Promise<ToldMark[]>;
  saveMark(mark: ToldMark): Promise<void>;
  deleteMark(id: string): Promise<void>;
  /** Kept apart from AppData so it isn't part of a backup. */
  getMeta(): Promise<Meta>;
  saveMeta(meta: Meta): Promise<void>;
  loadAll(): Promise<AppData>;
  /** Removes everything from this store. */
  deleteAll(): Promise<void>;
  /** Swaps in a full copy of the data. All or nothing: on failure the old data is untouched. */
  replaceAll(data: AppData, meta: Meta): Promise<void>;
}

export class RepositoryError extends Error {
  constructor(action: string, cause: unknown) {
    super(`Could not ${action}`, { cause });
    this.name = 'RepositoryError';
  }
}

export const STORES = ['kv', 'logs', 'readings', 'ratings', 'questions', 'prep', 'shopping', 'doctors', 'visits', 'marks'] as const;
export type StoreName = (typeof STORES)[number];

/** Every store and key a full copy of the data writes. */
export function entriesFor(data: AppData, meta: Meta): [StoreName, string, unknown][] {
  const out: [StoreName, string, unknown][] = [
    ['kv', 'timers', data.timers],
    ['kv', 'meta', meta],
  ];
  if (data.settings) out.push(['kv', 'settings', data.settings]);
  const add = (store: StoreName, items: { id: string }[]) => items.forEach((i) => out.push([store, i.id, i]));
  add('logs', data.logs);
  add('readings', data.readings);
  add('ratings', data.ratings);
  add('questions', data.questions);
  add('prep', data.prep);
  add('shopping', data.shopping);
  add('doctors', data.doctors);
  add('visits', data.visits);
  add('marks', data.marks);
  return out;
}

/** Typed methods over five storage primitives. Backends supply only the primitives. */
export abstract class BaseRepository implements Repository {
  abstract readonly persistent: boolean;
  protected abstract get<T>(store: StoreName, id: string): Promise<T | undefined>;
  protected abstract list<T>(store: StoreName): Promise<T[]>;
  protected abstract put(store: StoreName, id: string, value: unknown): Promise<void>;
  protected abstract remove(store: StoreName, id: string): Promise<void>;
  abstract deleteAll(): Promise<void>;
  abstract replaceAll(data: AppData, meta: Meta): Promise<void>;

  async getSettings() {
    return (await this.get<Settings>('kv', 'settings')) ?? null;
  }
  saveSettings(s: Settings) {
    return this.put('kv', 'settings', s);
  }
  async getTimers() {
    return (await this.get<Timers>('kv', 'timers')) ?? {};
  }
  saveTimers(t: Timers) {
    return this.put('kv', 'timers', t);
  }
  listLogs() {
    return this.list<LogEntry>('logs');
  }
  saveLog(e: LogEntry) {
    return this.put('logs', e.id, e);
  }
  deleteLog(id: string) {
    return this.remove('logs', id);
  }
  listReadings() {
    return this.list<ReadingEntry>('readings');
  }
  saveReading(e: ReadingEntry) {
    return this.put('readings', e.id, e);
  }
  listRatings() {
    return this.list<StepRating>('ratings');
  }
  saveRating(r: StepRating) {
    return this.put('ratings', r.id, r);
  }
  deleteRating(id: string) {
    return this.remove('ratings', id);
  }
  listQuestions() {
    return this.list<SavedQuestion>('questions');
  }
  saveQuestion(q: SavedQuestion) {
    return this.put('questions', q.id, q);
  }
  deleteQuestion(id: string) {
    return this.remove('questions', id);
  }
  listPrep() {
    return this.list<PrepItemState>('prep');
  }
  savePrep(i: PrepItemState) {
    return this.put('prep', i.id, i);
  }
  deletePrep(id: string) {
    return this.remove('prep', id);
  }
  listShopping() {
    return this.list<ShoppingItem>('shopping');
  }
  saveShopping(i: ShoppingItem) {
    return this.put('shopping', i.id, i);
  }
  deleteShopping(id: string) {
    return this.remove('shopping', id);
  }
  listDoctors() {
    return this.list<Doctor>('doctors');
  }
  saveDoctor(d: Doctor) {
    return this.put('doctors', d.id, d);
  }
  deleteDoctor(id: string) {
    return this.remove('doctors', id);
  }
  listVisits() {
    return this.list<Visit>('visits');
  }
  saveVisit(v: Visit) {
    return this.put('visits', v.id, v);
  }
  deleteVisit(id: string) {
    return this.remove('visits', id);
  }
  listMarks() {
    return this.list<ToldMark>('marks');
  }
  saveMark(m: ToldMark) {
    return this.put('marks', m.id, m);
  }
  deleteMark(id: string) {
    return this.remove('marks', id);
  }
  async getMeta(): Promise<Meta> {
    return (await this.get<Meta>('kv', 'meta')) ?? { lastBackupAt: null };
  }
  saveMeta(m: Meta) {
    return this.put('kv', 'meta', m);
  }
  async loadAll(): Promise<AppData> {
    const [settings, timers, logs, readings, ratings, questions, prep, shopping, doctors, visits, marks] = await Promise.all([
      this.getSettings(),
      this.getTimers(),
      this.listLogs(),
      this.listReadings(),
      this.listRatings(),
      this.listQuestions(),
      this.listPrep(),
      this.listShopping(),
      this.listDoctors(),
      this.listVisits(),
      this.listMarks(),
    ]);
    return { settings, timers, logs, readings, ratings, questions, prep, shopping, doctors, visits, marks };
  }
}
