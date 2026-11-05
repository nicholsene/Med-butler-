import type { Thresholds } from './decide';
import { computePatterns, DAY_MS, inWindow, isLowReading } from './patterns';
import { latestByStep, RATING_LABEL, type StepRating } from './ratings';
import type { Doctor, LogEntry, ReadingEntry, ToldMark, Visit } from '../repo/types';

export type GapKind = 'never_discussed' | 'changed' | 'rating_not_shared' | 'known_to_one' | 'pattern_not_raised' | 'medication_mismatch';

export const GAP_LABEL: Record<GapKind, string> = {
  never_discussed: 'Not recorded as discussed',
  changed: 'Changed since it last came up',
  rating_not_shared: 'Rating not shared',
  known_to_one: 'Recorded with one doctor, not another',
  pattern_not_raised: 'Pattern not raised',
  medication_mismatch: 'Medication lists differ',
};

const KIND_ORDER = Object.keys(GAP_LABEL) as GapKind[];

export type GapItem = {
  id: string;
  kind: GapKind;
  title: string;
  /** What a "told my doctor" mark is saved against. Marking it clears this item. */
  topic: string;
  /** Always says "may be worth raising", and never says a doctor did or didn't do anything. */
  summary: string;
  /** The counts and dates that produced this item. */
  evidence: string[];
  count: number;
  dates: number[];
  /** The line added to the Visit Brief. */
  briefText: string;
  /** For a mark, the doctors this item is about. */
  doctorIds: string[];
};

export type GapInput = {
  logs: LogEntry[];
  readings: ReadingEntry[];
  ratings: StepRating[];
  doctors: Doctor[];
  visits: Visit[];
  marks: ToldMark[];
  medications: string[];
  thresholds: Thresholds;
};

/** Only what happened in the last 90 days can raise a flag. Old history doesn't nag. */
export const LOOKBACK_DAYS = 90;
const MIN_LOGS = 2;
/** Under a week between windows is too short to compare fairly. */
const MIN_COMPARE_DAYS = 7;
const MIN_RISE = 2;
const RISE_RATIO = 1.5;
const MIN_BEFORE_FOR_FALL = 3;
const MAX_DATES_SHOWN = 8;

export const READING_TOPICS = ['Low readings', 'Very high readings', 'Pulse outside range'] as const;

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
export const dayText = (at: number) => dayFormat.format(new Date(at));

/** Each calendar day once, in order. Long lists are trimmed, with the rest counted. */
export function datesText(dates: number[]): string {
  const days = [...new Set([...dates].sort((a, b) => a - b).map(dayText))];
  if (days.length <= MAX_DATES_SHOWN) return days.join(', ');
  return `${days.slice(0, MAX_DATES_SHOWN).join(', ')} and ${days.length - MAX_DATES_SHOWN} more`;
}

const times = (n: number) => (n === 1 ? '1 time' : `${n} times`);
const days = (n: number) => (n === 1 ? '1 day' : `${n} days`);
const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const list = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

type Topic = { label: string; events: number[]; alwaysCounts: boolean };

/** Logged symptoms, plus readings outside the set limits, as things that could be discussed. */
function collectTopics(logs: LogEntry[], readings: ReadingEntry[], t: Thresholds): Map<string, Topic> {
  const topics = new Map<string, Topic>();
  const add = (label: string, at: number, alwaysCounts = false) => {
    const key = norm(label);
    const topic = topics.get(key) ?? { label, events: [], alwaysCounts: false };
    topic.events.push(at);
    // One severe log or one very high reading is enough on its own.
    topic.alwaysCounts ||= alwaysCounts;
    topics.set(key, topic);
  };
  for (const l of logs) for (const chip of new Set(l.chips)) add(chip, l.at, l.severity === 'severe');
  for (const r of readings) {
    if (isLowReading(r, t)) add(READING_TOPICS[0], r.at);
    if ((r.systolic ?? 0) > t.veryHighBp.systolicAbove || (r.diastolic ?? 0) > t.veryHighBp.diastolicAbove) add(READING_TOPICS[1], r.at, true);
    if (r.pulse != null && (r.pulse < t.restingPulse.min || r.pulse > t.restingPulse.max)) add(READING_TOPICS[2], r.at);
  }
  return topics;
}

type Discussion = { at: number; doctorId: string | null };

function discussionsOf(key: string, visits: Visit[], marks: ToldMark[], now: number): Discussion[] {
  const fromVisits = visits.filter((v) => v.symptomsDiscussed.some((s) => norm(s) === key)).map((v) => ({ at: v.at, doctorId: v.doctorId }));
  const fromMarks = marks.filter((m) => norm(m.topic) === key).map((m) => ({ at: m.at, doctorId: m.doctorId }));
  return [...fromVisits, ...fromMarks].filter((d) => d.at <= now).sort((a, b) => a.at - b.at);
}

/** A name without its dose, so "Sample 10 mg" and "Sample" count as the same medication. */
const medName = (m: string) => norm(m).replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?|%)?(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();

type Rule = (input: GapInput, now: number) => GapItem[];

const neverDiscussed: Rule = (input, now) => {
  const out: GapItem[] = [];
  const recentLogs = inWindow(input.logs, now, LOOKBACK_DAYS);
  const recentReadings = inWindow(input.readings, now, LOOKBACK_DAYS);
  for (const [key, topic] of collectTopics(recentLogs, recentReadings, input.thresholds)) {
    if (topic.events.length < MIN_LOGS && !topic.alwaysCounts) continue;
    if (discussionsOf(key, input.visits, input.marks, now).length) continue;
    const n = topic.events.length;
    const first = dayText(Math.min(...topic.events));
    out.push({
      id: `never:${key}`,
      kind: 'never_discussed',
      title: topic.label,
      topic: topic.label,
      summary: `${topic.label} may be worth raising. It isn't in any visit or "told my doctor" mark saved here.`,
      evidence: [`Counted ${times(n)} in the last ${LOOKBACK_DAYS} days.`, `On: ${datesText(topic.events)}.`, 'Visits or marks that include it: 0.'],
      count: n,
      dates: topic.events,
      briefText: `${topic.label} may be worth raising: counted ${times(n)} since ${first}, not yet recorded here as discussed.`,
      doctorIds: [],
    });
  }
  return out;
};

const changedSinceDiscussed: Rule = (input, now) => {
  const out: GapItem[] = [];
  const allTimes = [...input.logs, ...input.readings].map((e) => e.at).filter((at) => at <= now);
  if (!allTimes.length) return out;
  // Before her first entry there's no data, and "no data" must not read as "it wasn't happening".
  const firstRecord = Math.min(...allTimes);

  for (const [key, topic] of collectTopics(input.logs, input.readings, input.thresholds)) {
    const said = discussionsOf(key, input.visits, input.marks, now);
    if (!said.length) continue;
    const last = said[said.length - 1].at;
    const windowMs = Math.min(now - last, last - firstRecord, LOOKBACK_DAYS * DAY_MS);
    if (windowMs < MIN_COMPARE_DAYS * DAY_MS) continue;
    const before = topic.events.filter((at) => at > last - windowMs && at <= last);
    const after = topic.events.filter((at) => at > now - windowMs && at <= now);
    const rose = after.length - before.length >= MIN_RISE && after.length >= before.length * RISE_RATIO;
    const fell = before.length >= MIN_BEFORE_FOR_FALL && after.length * 2 <= before.length;
    if (!rose && !fell) continue;
    const span = days(Math.round(windowMs / DAY_MS));
    const direction = rose ? 'more' : 'less';
    out.push({
      id: `changed:${key}`,
      kind: 'changed',
      title: topic.label,
      topic: topic.label,
      summary: `${topic.label} may be worth raising. It has been counted ${direction} often since it last came up on ${dayText(last)}.`,
      evidence: [
        `The ${span} before ${dayText(last)}: ${times(before.length)}${before.length ? ` (${datesText(before)})` : ''}.`,
        `The latest ${span}: ${times(after.length)}${after.length ? ` (${datesText(after)})` : ''}.`,
      ],
      count: after.length,
      dates: [...before, ...after],
      briefText: `${topic.label} may be worth raising: ${times(after.length)} in the latest ${span}, compared with ${times(before.length)} in the ${span} before ${dayText(last)}.`,
      doctorIds: [],
    });
  }
  return out;
};

const patternNotRaised: Rule = (input, now) =>
  computePatterns(input.logs, input.readings, input.thresholds, now)
    .filter((p) => !input.marks.some((m) => m.topic === `pattern:${p.id}` && m.at <= now))
    .map((p) => {
      const text = `${p.headline} ${p.detail}`;
      return {
        id: `pattern:${p.id}`,
        kind: 'pattern_not_raised' as const,
        title: p.headline,
        topic: `pattern:${p.id}`,
        summary: `This pattern may be worth raising: ${text}. It's a count from your log, not a cause.`,
        evidence: [`${p.count} of ${p.total} in the last 30 days.`, `On: ${datesText(p.dates)}.`, '"Told my doctor" marks for this pattern: 0.'],
        count: p.count,
        dates: p.dates,
        briefText: `A pattern that may be worth raising: ${text} (last 30 days, a count and not a cause).`,
        doctorIds: [],
      };
    });

const knownToOne: Rule = (input, now) => {
  const out: GapItem[] = [];
  if (input.doctors.length < 2) return out;
  const recentLogs = inWindow(input.logs, now, LOOKBACK_DAYS);
  const recentReadings = inWindow(input.readings, now, LOOKBACK_DAYS);
  for (const [key, topic] of collectTopics(recentLogs, recentReadings, input.thresholds)) {
    const said = discussionsOf(key, input.visits, input.marks, now);
    const told = input.doctors.filter((d) => said.some((s) => s.doctorId === d.id));
    const others = input.doctors.filter((d) => !told.includes(d));
    if (!told.length || !others.length) continue;
    const lastWith = (d: Doctor) => Math.max(...said.filter((s) => s.doctorId === d.id).map((s) => s.at));
    const toldText = told.map((d) => `${d.role} (${dayText(lastWith(d))})`);
    const otherRoles = others.map((d) => d.role);
    out.push({
      id: `known:${key}`,
      kind: 'known_to_one',
      title: topic.label,
      topic: topic.label,
      summary: `${topic.label} may be worth raising with ${list(otherRoles)}. It's recorded here with ${list(told.map((d) => d.role))} only.`,
      evidence: [
        `Counted ${times(topic.events.length)} in the last ${LOOKBACK_DAYS} days, most recently ${dayText(Math.max(...topic.events))}.`,
        `Recorded here with: ${list(toldText)}.`,
        `Nothing recorded here with: ${list(otherRoles)}.`,
      ],
      count: topic.events.length,
      dates: [...said.map((s) => s.at), ...topic.events],
      briefText: `${topic.label} may be worth raising with ${list(otherRoles)}: recorded here with ${list(toldText)}.`,
      doctorIds: others.map((d) => d.id),
    });
  }
  return out;
};

const ratingNotShared: Rule = (input, now) => {
  const recent = inWindow(input.ratings, now, LOOKBACK_DAYS);
  const rank = { made_worse: 0, didnt_help: 1, helped: 2, not_now: 3 };
  return [...latestByStep(recent).values()]
    .filter((r) => r.rating !== 'not_now')
    .sort((a, b) => rank[a.rating] - rank[b.rating] || b.at - a.at)
    .flatMap((r) => {
      const topic = `rating:${r.cardId}|${r.stepId}`;
      // A newer rating is new information, so an older mark doesn't cover it.
      if (input.marks.some((m) => m.topic === topic && m.at >= r.at && m.at <= now)) return [];
      const label = RATING_LABEL[r.rating];
      return [
        {
          id: topic,
          kind: 'rating_not_shared' as const,
          title: r.stepText,
          topic,
          summary: `Your rating "${label}" may be worth raising. There's no "told my doctor" mark for it here.`,
          evidence: [`Rated "${label}" on ${dayText(r.at)}, from the guide "${r.cardTitle}".`],
          count: 1,
          dates: [r.at],
          briefText: `May be worth raising: I rated "${r.stepText}" as "${label}" on ${dayText(r.at)}.`,
          doctorIds: [],
        },
      ];
    });
};

const medicationMismatch: Rule = (input, now) => {
  const out: GapItem[] = [];
  const mine = input.medications.map((m) => m.trim()).filter(Boolean);
  if (!mine.length) return out;
  for (const doctor of input.doctors) {
    const visit = input.visits
      .filter((v) => v.doctorId === doctor.id && v.medications !== null && v.at <= now)
      .sort((a, b) => b.at - a.at)[0];
    if (!visit) continue;
    const theirs = (visit.medications ?? []).map((m) => m.trim()).filter(Boolean);
    const byName = (items: string[]) => new Map(items.map((m) => [medName(m), m]));
    const mineByName = byName(mine);
    const theirsByName = byName(theirs);
    const onlyMine = [...mineByName].filter(([k]) => !theirsByName.has(k)).map(([, v]) => v);
    const onlyTheirs = [...theirsByName].filter(([k]) => !mineByName.has(k)).map(([, v]) => v);
    const differs = [...mineByName]
      .filter(([k, v]) => theirsByName.has(k) && norm(v) !== norm(theirsByName.get(k)!))
      .map(([k, v]) => `${v} / ${theirsByName.get(k)}`);
    const n = onlyMine.length + onlyTheirs.length + differs.length;
    if (!n) continue;
    // The topic carries the differences, so a mark stops covering it if the lists change again.
    const topic = `medication:${doctor.id}:${[...onlyMine, ...onlyTheirs, ...differs].map(norm).sort().join('|')}`;
    if (input.marks.some((m) => m.topic === topic && m.at >= visit.at && m.at <= now)) continue;
    const when = dayText(visit.at);
    out.push({
      id: `medication:${doctor.id}`,
      kind: 'medication_mismatch',
      title: `Medication list and ${doctor.role}`,
      topic,
      summary: `Your medication list and the one saved from ${doctor.role} on ${when} may be worth raising. They may only be written differently.`,
      evidence: [
        `${mine.length} on your list in this app, ${theirs.length} on the list saved with the visit on ${when}.`,
        ...(onlyMine.length ? [`Only on your list: ${onlyMine.join(', ')}.`] : []),
        ...(onlyTheirs.length ? [`Only on the visit list: ${onlyTheirs.join(', ')}.`] : []),
        ...(differs.length ? [`Written differently: ${differs.join('; ')}.`] : []),
      ],
      count: n,
      dates: [visit.at],
      briefText: `May be worth raising: my medication list and the one saved from ${doctor.role} on ${when} differ on ${n === 1 ? '1 item' : `${n} items`}.`,
      doctorIds: [doctor.id],
    });
  }
  return out;
};

/**
 * Pure, and run only on the phone. Compares what she logged with what's recorded as discussed.
 * This only knows what was saved here, so nothing it returns says what a doctor knows or did.
 * Items with no gap simply aren't returned.
 */
export function computeGaps(input: GapInput, now: number): GapItem[] {
  const rules = [neverDiscussed, changedSinceDiscussed, ratingNotShared, knownToOne, patternNotRaised, medicationMismatch];
  return rules
    .flatMap((rule) => rule(input, now))
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (a.kind === 'rating_not_shared' ? 0 : b.count - a.count));
}

/** A date from the visit form as a time. Null if it isn't a real date or hasn't happened yet. */
export function visitTime(date: string, now: number): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const noon = new Date(y, mo - 1, d, 12);
  if (noon.getMonth() !== mo - 1 || noon.getDate() !== d) return null;
  const startOfDay = new Date(y, mo - 1, d).getTime();
  if (startOfDay > now) return null;
  return Math.min(noon.getTime(), now);
}

export type SymptomRow = { label: string; count: number; lastDiscussedAt: number | null };

/** Symptoms from the last 90 days with when each last came up, for quick marking. */
export function symptomRows(input: Pick<GapInput, 'logs' | 'readings' | 'visits' | 'marks' | 'thresholds'>, now: number): SymptomRow[] {
  const topics = collectTopics(inWindow(input.logs, now, LOOKBACK_DAYS), inWindow(input.readings, now, LOOKBACK_DAYS), input.thresholds);
  return [...topics]
    .map(([key, t]) => {
      const said = discussionsOf(key, input.visits, input.marks, now);
      return { label: t.label, count: t.events.length, lastDiscussedAt: said.length ? said[said.length - 1].at : null };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
