import { computeGaps } from './gaps';
import { scrubContactDetails } from './contactPatterns.mjs';
import type { AppData, Settings } from '../repo/types';

export const DEEP_REVIEW_FORMAT = 'medical-butler-deep-review';

export type DeepReviewOptions = {
  /** Free-text visit notes are the likeliest place for a name, so they stay out unless she asks. */
  includeNotes: boolean;
};

export type DeepReview = {
  format: typeof DEEP_REVIEW_FORMAT;
  createdAt: string;
  removed: string[];
  conditions: string[];
  medications: string[];
  thresholds: Settings['thresholds'] | null;
  doctors: { role: string }[];
  visits: { date: string; doctor: string; symptomsDiscussed: string[]; medications: string[] | null; notes?: string }[];
  toldMarks: { date: string; topic: string; doctor: string | null }[];
  logs: { date: string; symptoms: string[]; severity: string; ateRecently: boolean }[];
  readings: {
    date: string;
    systolic: number | null;
    diastolic: number | null;
    pulse: number | null;
    temperature: number | null;
    symptoms: Record<string, boolean | undefined>;
    situation: string | null;
    guide: string | null;
  }[];
  stepRatings: { date: string; guide: string; step: string; rating: string; safety: boolean }[];
  questions: { date: string; text: string }[];
  gapReview: { kind: string; title: string; summary: string; evidence: string[] }[];
};

const iso = (at: number) => new Date(at).toISOString();

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The names she has saved: her own, and what she calls her contacts. Her saved text is matched against them. */
function savedNames(settings: Settings | null): string[] {
  if (!settings) return [];
  return [settings.name, settings.labels?.contactA, settings.labels?.contactB]
    .flatMap((n) => (n ?? '').split(/\s+/))
    .map((n) => n.trim())
    .filter((n) => n.length >= 2 && !/^contact$|^\d+$/i.test(n));
}

/** Removes contact details, her saved names, and anything written like a title and surname. */
export function scrubText(text: string, names: string[]): string {
  let out = scrubContactDetails(text).replace(/\b(?:Dr|Doctor|Mr|Mrs|Ms|Prof)\.?\s+[A-Z][\w'-]*/g, '[name removed]');
  for (const name of names) {
    // Not \b, because it doesn't treat accented letters as part of a word.
    out = out.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(name)}(?=$|[^\\p{L}\\p{N}])`, 'giu'), '$1[name removed]');
  }
  return out;
}

function scrubAll<T>(value: T, names: string[]): T {
  if (typeof value === 'string') return scrubText(value, names) as T;
  if (Array.isArray(value)) return value.map((v) => scrubAll(v, names)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubAll(v, names)])) as T;
  }
  return value;
}

/**
 * Pure. Builds the review file from an allow-list: only fields named here can reach it.
 * Her name, phone numbers, contact labels, IDs, timers, kits and shopping are never copied.
 */
export function buildDeepReview(data: AppData, options: DeepReviewOptions, now: number): DeepReview {
  const s = data.settings;
  const role = (id: string | null) => (id ? (data.doctors.find((d) => d.id === id)?.role ?? 'Doctor no longer listed') : null);
  const review: DeepReview = {
    format: DEEP_REVIEW_FORMAT,
    createdAt: iso(now),
    removed: [
      'Your name',
      'Phone numbers and contact names',
      options.includeNotes ? 'Emails, phone numbers, addresses and links found in your text' : 'Visit notes',
      'Internal IDs, timers, kits and shopping',
    ],
    conditions: s?.conditions ?? [],
    medications: s?.medications ?? [],
    thresholds: s?.thresholds ?? null,
    doctors: data.doctors.map((d) => ({ role: d.role })),
    visits: [...data.visits]
      .sort((a, b) => a.at - b.at)
      .map((v) => ({
        date: iso(v.at),
        doctor: role(v.doctorId) ?? '',
        symptomsDiscussed: v.symptomsDiscussed,
        medications: v.medications,
        ...(options.includeNotes && v.notes ? { notes: v.notes } : {}),
      })),
    toldMarks: [...data.marks]
      .sort((a, b) => a.at - b.at)
      .map((m) => ({ date: iso(m.at), topic: m.topic, doctor: role(m.doctorId) })),
    logs: [...data.logs].sort((a, b) => a.at - b.at).map((l) => ({ date: iso(l.at), symptoms: l.chips, severity: l.severity, ateRecently: l.ateRecently })),
    readings: [...data.readings].sort((a, b) => a.at - b.at).map((r) => ({
      date: iso(r.at),
      systolic: r.systolic,
      diastolic: r.diastolic,
      pulse: r.pulse,
      temperature: r.temperature,
      symptoms: r.symptoms,
      situation: r.situation,
      guide: r.cardId,
    })),
    stepRatings: [...data.ratings].sort((a, b) => a.at - b.at).map((r) => ({ date: iso(r.at), guide: r.cardTitle, step: r.stepText, rating: r.rating, safety: r.safety })),
    questions: data.questions.filter((q) => !q.dismissed).map((q) => ({ date: iso(q.at), text: q.text })),
    gapReview: s
      ? computeGaps(
          { logs: data.logs, readings: data.readings, ratings: data.ratings, doctors: data.doctors, visits: data.visits, marks: data.marks, medications: s.medications, thresholds: s.thresholds },
          now,
        ).map((g) => ({ kind: g.kind, title: g.title, summary: g.summary, evidence: g.evidence }))
      : [],
  };
  return scrubAll(review, savedNames(s));
}

export type DeepReviewContent = { label: string; count: number };

/** The plain-language contents list shown above the file's text. */
export function describeDeepReview(r: DeepReview): DeepReviewContent[] {
  return [
    { label: 'Conditions', count: r.conditions.length },
    { label: 'Medications', count: r.medications.length },
    { label: 'Doctors, by role only', count: r.doctors.length },
    { label: 'Visits', count: r.visits.length },
    { label: 'Visit notes', count: r.visits.filter((v) => v.notes).length },
    { label: '"Told my doctor" marks', count: r.toldMarks.length },
    { label: 'Symptom logs', count: r.logs.length },
    { label: 'Readings', count: r.readings.length },
    { label: 'Step ratings', count: r.stepRatings.length },
    { label: 'Saved questions', count: r.questions.length },
    { label: 'Gap review items', count: r.gapReview.length },
  ];
}
