import type { Situation, Symptoms, Thresholds } from '../logic/decide';
import type { StepRating } from '../logic/ratings';

export type Voice = 'steady' | 'warm';
export type Severity = 'mild' | 'moderate' | 'severe';

export type LogEntry = {
  id: string;
  at: number;
  chips: string[];
  severity: Severity;
  ateRecently: boolean;
};

export type ReadingEntry = {
  id: string;
  at: number;
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  temperature: number | null;
  symptoms: Symptoms;
  situation: Situation | null;
  cardId: string | null;
};

export type SavedQuestion = {
  id: string;
  text: string;
  at: number;
  cardId: string | null;
  /** A card question she removed. Kept so opening the guide again doesn't re-add it. */
  dismissed?: boolean;
  /** The Doctor Gap Review item this was added from, so the button can show it's already there. */
  gapId?: string;
};

export type PrepItemState = {
  id: string;
  cardId: string;
  location: string;
  item: string;
  have: boolean;
  custom: boolean;
};

export type ShoppingItem = {
  id: string;
  name: string;
  done: boolean;
  /** The kit row this came from, so buying it can tick the kit. */
  prepId: string | null;
};

/** Known by role only, on purpose. There is no name or phone field. */
export type Doctor = {
  id: string;
  role: string;
};

export type Visit = {
  id: string;
  doctorId: string;
  /** The day of the visit, stored as local noon. */
  at: number;
  symptomsDiscussed: string[];
  notes: string;
  /** Null when no medication list was recorded for this visit. */
  medications: string[] | null;
};

/** A quick "told my doctor". Topic is a symptom name, or a key from the gap review. */
export type ToldMark = {
  id: string;
  topic: string;
  at: number;
  /** Null when she didn't say which doctor. */
  doctorId: string | null;
};

export type Meta = {
  lastBackupAt: number | null;
};

export type Labels = {
  now: string;
  log: string;
  map: string;
  prep: string;
  brief: string;
  gaps: string;
  visits: string;
  settings: string;
  serious: string;
  logThis: string;
  steady: string;
  warm: string;
  contactA: string;
  contactB: string;
};

export type Settings = {
  setupComplete: boolean;
  name: string;
  conditions: string[];
  medications: string[];
  phones: { contactA: string; contactB: string };
  thresholds: Thresholds;
  voice: Voice;
  labels: Labels;
  customChips: string[];
  /** Which contacts get a text button on the emergency screen. */
  textContacts: { contactA: boolean; contactB: boolean };
  emergencyText: string;
};

export type Timers = Record<string, number>;

export type AppData = {
  settings: Settings | null;
  logs: LogEntry[];
  readings: ReadingEntry[];
  ratings: StepRating[];
  questions: SavedQuestion[];
  prep: PrepItemState[];
  shopping: ShoppingItem[];
  timers: Timers;
  doctors: Doctor[];
  visits: Visit[];
  marks: ToldMark[];
};
