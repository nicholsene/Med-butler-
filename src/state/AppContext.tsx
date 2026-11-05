import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { requestPersist, type PersistStatus } from '../logic/device';
import { defaultSettings, withDefaults } from '../data/defaults';
import type { Card, CardStep } from '../data/card.types';
import type { Decision, Symptoms, Vitals } from '../logic/decide';
import { prepId, type KitRow } from '../logic/prep';
import type { RatingValue, StepRating } from '../logic/ratings';
import { createRepository } from '../repo/createRepository';
import type { Repository } from '../repo/Repository';
import type { AppData, Doctor, LogEntry, Meta, ReadingEntry, Settings, ToldMark, Visit, Voice } from '../repo/types';

export const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export type Session = {
  vitals: Vitals | null;
  symptoms: Symptoms;
  decision: Decision | null;
  /** True between a very-high first reading and its second reading. */
  awaitingRecheck: boolean;
};
const EMPTY_SESSION: Session = { vitals: null, symptoms: {}, decision: null, awaitingRecheck: false };

const emptyData = (): Omit<AppData, 'settings'> & { settings: Settings } => ({
  settings: defaultSettings(),
  logs: [],
  readings: [],
  ratings: [],
  questions: [],
  prep: [],
  shopping: [],
  timers: {},
  doctors: [],
  visits: [],
  marks: [],
});

type Data = ReturnType<typeof emptyData>;

type App = Data & {
  session: Session;
  setSession(s: Partial<Session>): void;
  persistent: boolean;
  storageError: string | null;
  dismissStorageError(): void;
  updateSettings(patch: Partial<Settings>): void;
  setVoice(v: Voice): void;
  addLog(entry: Omit<LogEntry, 'id' | 'at'>): LogEntry;
  deleteLog(id: string): void;
  addReading(entry: Omit<ReadingEntry, 'id' | 'at'>): void;
  rateStep(card: Card, step: CardStep, rating: RatingValue): void;
  clearStepRatings(cardId: string, stepId: string): void;
  saveCardQuestions(card: Card): void;
  addQuestion(text: string, gapId?: string): void;
  removeQuestion(id: string): void;
  setHave(row: Pick<KitRow, 'id' | 'cardId' | 'location' | 'item' | 'custom'>, have: boolean): void;
  addCustomItem(cardId: string, location: string, item: string): void;
  removeCustomItem(id: string): void;
  addToShopping(names: { name: string; prepId: string | null }[]): void;
  toggleShopping(id: string): void;
  removeShopping(id: string): void;
  setTimer(key: string, endsAt: number | null): void;
  addDoctor(role: string): Doctor;
  removeDoctor(id: string): void;
  addVisit(visit: Omit<Visit, 'id'>): void;
  removeVisit(id: string): void;
  addMark(topic: string, doctorId: string | null): void;
  removeMark(id: string): void;
  deleteAllData(): Promise<boolean>;
  /** Everything as stored, read fresh rather than from what's on screen. */
  readAllData(): Promise<AppData>;
  /** Swaps in a backup's data. True only when it was fully saved. */
  restoreData(next: AppData, backedUpAt: number): Promise<boolean>;
  meta: Meta;
  markBackedUp(at: number): void;
  persistStatus: PersistStatus;
  askToPersist(): Promise<void>;
};

const Ctx = createContext<App | null>(null);

export function useApp(): App {
  const app = useContext(Ctx);
  if (!app) throw new Error('useApp outside AppProvider');
  return app;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [data, setData] = useState<Data>(emptyData);
  const [session, setSessionState] = useState<Session>(EMPTY_SESSION);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta>({ lastBackupAt: null });
  const [persistStatus, setPersistStatus] = useState<PersistStatus>('unknown');

  useEffect(() => {
    let live = true;
    void (async () => {
      const r = await createRepository();
      try {
        const [loaded, savedMeta] = await Promise.all([r.loadAll(), r.getMeta()]);
        if (live) {
          setData({ ...loaded, settings: withDefaults(loaded.settings) });
          setMeta(savedMeta);
        }
      } catch (err) {
        console.error(err);
        if (live) setStorageError("Your saved data couldn't be read. Please close and reopen the app.");
      }
      if (live) setRepo(r);
    })();
    return () => {
      live = false;
    };
  }, []);

  // Asked once first-open setup is done, then again each launch until the browser agrees.
  const setupDone = data.settings.setupComplete;
  useEffect(() => {
    if (!repo || !setupDone) return;
    let live = true;
    void requestPersist().then((status) => {
      if (live) setPersistStatus(status);
    });
    return () => {
      live = false;
    };
  }, [repo, setupDone]);

  /** Screens update right away. A failed save shows a banner instead of silently losing data. */
  const save = useCallback(
    (op: (r: Repository) => Promise<unknown>) => {
      if (!repo) return;
      op(repo).catch((err) => {
        console.error(err);
        setStorageError("That didn't save to this phone. It's on screen for now, but may be lost if you close the app.");
      });
    },
    [repo],
  );

  const app = useMemo<App | null>(() => {
    if (!repo) return null;
    const saveSettings = (settings: Settings) => save((r) => r.saveSettings(settings));
    return {
      ...data,
      session,
      setSession: (s) => setSessionState((prev) => ({ ...prev, ...s })),
      persistent: repo.persistent,
      storageError,
      dismissStorageError: () => setStorageError(null),

      updateSettings(patch) {
        const settings = { ...data.settings, ...patch };
        setData((d) => ({ ...d, settings }));
        saveSettings(settings);
      },
      setVoice(voice) {
        const settings = { ...data.settings, voice };
        setData((d) => ({ ...d, settings }));
        saveSettings(settings);
      },

      addLog(partial) {
        const entry: LogEntry = { ...partial, id: newId(), at: Date.now() };
        setData((d) => ({ ...d, logs: [...d.logs, entry] }));
        save((r) => r.saveLog(entry));
        return entry;
      },
      deleteLog(id) {
        setData((d) => ({ ...d, logs: d.logs.filter((l) => l.id !== id) }));
        save((r) => r.deleteLog(id));
      },

      addReading(partial) {
        const entry: ReadingEntry = { ...partial, id: newId(), at: Date.now() };
        setData((d) => ({ ...d, readings: [...d.readings, entry] }));
        save((r) => r.saveReading(entry));
      },

      rateStep(card, step, rating) {
        const entry: StepRating = {
          id: newId(),
          cardId: card.id,
          stepId: step.id,
          rating,
          at: Date.now(),
          stepText: step.steady,
          cardTitle: card.title,
          safety: step.safety,
        };
        setData((d) => ({ ...d, ratings: [...d.ratings, entry] }));
        save((r) => r.saveRating(entry));
      },
      clearStepRatings(cardId, stepId) {
        const gone = data.ratings.filter((x) => x.cardId === cardId && x.stepId === stepId);
        setData((d) => ({ ...d, ratings: d.ratings.filter((x) => !gone.includes(x)) }));
        save((r) => Promise.all(gone.map((x) => r.deleteRating(x.id))));
      },

      saveCardQuestions(card) {
        const known = new Set(data.questions.map((q) => q.text));
        const fresh = card.doctorQuestions
          .filter((text) => !known.has(text))
          .map((text) => ({ id: newId(), text, at: Date.now(), cardId: card.id }));
        if (!fresh.length) return;
        setData((d) => ({ ...d, questions: [...d.questions, ...fresh] }));
        save((r) => Promise.all(fresh.map((q) => r.saveQuestion(q))));
      },
      addQuestion(text, gapId) {
        const q = { id: newId(), text, at: Date.now(), cardId: null, ...(gapId ? { gapId } : {}) };
        setData((d) => ({ ...d, questions: [...d.questions, q] }));
        save((r) => r.saveQuestion(q));
      },
      removeQuestion(id) {
        const q = data.questions.find((x) => x.id === id);
        if (!q) return;
        if (q.cardId) {
          const dismissed = { ...q, dismissed: true };
          setData((d) => ({ ...d, questions: d.questions.map((x) => (x.id === id ? dismissed : x)) }));
          save((r) => r.saveQuestion(dismissed));
        } else {
          setData((d) => ({ ...d, questions: d.questions.filter((x) => x.id !== id) }));
          save((r) => r.deleteQuestion(id));
        }
      },

      setHave(row, have) {
        const item = { id: row.id, cardId: row.cardId, location: row.location, item: row.item, custom: row.custom, have };
        setData((d) => ({ ...d, prep: [...d.prep.filter((p) => p.id !== row.id), item] }));
        save((r) => r.savePrep(item));
      },
      addCustomItem(cardId, location, name) {
        const item = { id: prepId(cardId, location, name), cardId, location, item: name, custom: true, have: false };
        setData((d) => ({ ...d, prep: [...d.prep.filter((p) => p.id !== item.id), item] }));
        save((r) => r.savePrep(item));
      },
      removeCustomItem(id) {
        setData((d) => ({ ...d, prep: d.prep.filter((p) => p.id !== id) }));
        save((r) => r.deletePrep(id));
      },

      addToShopping(names) {
        const existing = new Set(data.shopping.filter((s) => !s.done).map((s) => s.name));
        const fresh = [...new Map(names.map((n) => [n.name, n])).values()]
          .filter((n) => !existing.has(n.name))
          .map((n) => ({ id: newId(), name: n.name, prepId: n.prepId, done: false }));
        setData((d) => ({ ...d, shopping: [...d.shopping, ...fresh] }));
        save((r) => Promise.all(fresh.map((s) => r.saveShopping(s))));
      },
      toggleShopping(id) {
        const item = data.shopping.find((s) => s.id === id);
        if (!item) return;
        const next = { ...item, done: !item.done };
        setData((d) => ({ ...d, shopping: d.shopping.map((s) => (s.id === id ? next : s)) }));
        save((r) => r.saveShopping(next));
      },
      removeShopping(id) {
        setData((d) => ({ ...d, shopping: d.shopping.filter((s) => s.id !== id) }));
        save((r) => r.deleteShopping(id));
      },

      setTimer(key, endsAt) {
        const timers = { ...data.timers };
        if (endsAt === null) delete timers[key];
        else timers[key] = endsAt;
        setData((d) => ({ ...d, timers }));
        save((r) => r.saveTimers(timers));
      },

      addDoctor(role) {
        const doctor: Doctor = { id: newId(), role };
        setData((d) => ({ ...d, doctors: [...d.doctors, doctor] }));
        save((r) => r.saveDoctor(doctor));
        return doctor;
      },
      removeDoctor(id) {
        setData((d) => ({ ...d, doctors: d.doctors.filter((x) => x.id !== id) }));
        save((r) => r.deleteDoctor(id));
      },
      addVisit(partial) {
        const visit: Visit = { ...partial, id: newId() };
        setData((d) => ({ ...d, visits: [...d.visits, visit] }));
        save((r) => r.saveVisit(visit));
      },
      removeVisit(id) {
        setData((d) => ({ ...d, visits: d.visits.filter((x) => x.id !== id) }));
        save((r) => r.deleteVisit(id));
      },
      addMark(topic, doctorId) {
        const mark: ToldMark = { id: newId(), topic, at: Date.now(), doctorId };
        setData((d) => ({ ...d, marks: [...d.marks, mark] }));
        save((r) => r.saveMark(mark));
      },
      removeMark(id) {
        setData((d) => ({ ...d, marks: d.marks.filter((x) => x.id !== id) }));
        save((r) => r.deleteMark(id));
      },

      meta,
      markBackedUp(at) {
        const next = { ...meta, lastBackupAt: at };
        setMeta(next);
        save((r) => r.saveMeta(next));
      },
      persistStatus,
      async askToPersist() {
        setPersistStatus(await requestPersist());
      },

      readAllData: () => repo.loadAll(),
      async restoreData(next, backedUpAt) {
        const nextMeta = { lastBackupAt: backedUpAt };
        try {
          await repo.replaceAll(next, nextMeta);
          setData({ ...next, settings: withDefaults(next.settings) });
          setMeta(nextMeta);
          setSessionState(EMPTY_SESSION);
          setStorageError(null);
          return true;
        } catch (err) {
          console.error(err);
          setStorageError("That backup couldn't be saved, so your data here wasn't changed. Please try again.");
          return false;
        }
      },

      async deleteAllData() {
        try {
          await repo.deleteAll();
          setData(emptyData());
          setMeta({ lastBackupAt: null });
          setSessionState(EMPTY_SESSION);
          setStorageError(null);
          return true;
        } catch (err) {
          console.error(err);
          setStorageError("Your data couldn't be deleted. Nothing was removed. Please try again.");
          return false;
        }
      },
    };
  }, [repo, data, session, storageError, save, meta, persistStatus]);

  if (!app) return <p className="loading">Opening…</p>;
  return <Ctx.Provider value={app}>{children}</Ctx.Provider>;
}
