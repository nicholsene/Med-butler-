import type { Thresholds } from './decide';
import type { LogEntry, ReadingEntry } from '../repo/types';

export const DAY_MS = 86_400_000;
export const ASSOCIATION_NOTE = 'Association only, counted from your log. This is not a diagnosis.';
const MIN_TOTAL = 3;
const MIN_COUNT = 2;

export type Pattern = {
  id: string;
  kind: 'meal' | 'together' | 'time_of_day' | 'reading';
  label: 'Association';
  headline: string;
  detail: string;
  count: number;
  total: number;
  /** When the counted entries happened, so a count can be traced back. */
  dates: number[];
};

export const inWindow = <T extends { at: number }>(items: T[], now: number, days: number) =>
  items.filter((i) => i.at <= now && i.at > now - days * DAY_MS);

export function chipCounts(logs: LogEntry[]): { chip: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const log of logs) for (const chip of new Set(log.chips)) counts.set(chip, (counts.get(chip) ?? 0) + 1);
  return [...counts].map(([chip, count]) => ({ chip, count })).sort((a, b) => b.count - a.count || a.chip.localeCompare(b.chip));
}

export function isLowReading(r: ReadingEntry, t: Thresholds): boolean {
  return (
    (r.systolic != null && r.systolic < t.lowBp.systolicBelow) ||
    (r.diastolic != null && r.diastolic < t.lowBp.diastolicBelow)
  );
}

function partOfDay(at: number) {
  const h = new Date(at).getHours();
  if (h < 5) return 'overnight';
  if (h < 12) return 'in the morning';
  if (h < 17) return 'in the afternoon';
  if (h < 21) return 'in the evening';
  return 'overnight';
}

const SYMPTOM_TEXT: Record<string, string> = {
  shakySweaty: 'shaky or sweaty',
  veryHungry: 'very hungry',
  diarrhea: 'diarrhea',
  darkUrine: 'dark urine',
  vomiting: 'vomiting',
  ateRecently: 'a meal in the last 2 hours',
};

/** Pure counts over the last N days. Nothing here infers a cause. */
export function computePatterns(
  allLogs: LogEntry[],
  allReadings: ReadingEntry[],
  thresholds: Thresholds,
  now: number,
  days = 30,
): Pattern[] {
  const logs = inWindow(allLogs, now, days);
  const readings = inWindow(allReadings, now, days);
  const out: Pattern[] = [];
  const make = (id: string, kind: Pattern['kind'], headline: string, detail: string, counted: { at: number }[], total: number) =>
    out.push({ id, kind, label: 'Association', headline, detail, count: counted.length, total, dates: counted.map((c) => c.at) });
  const counted = chipCounts(logs).filter((c) => c.count >= MIN_TOTAL);

  for (const { chip, count: total } of counted) {
    const withChip = logs.filter((l) => l.chips.includes(chip));
    const meal = withChip.filter((l) => l.ateRecently);
    if (meal.length >= MIN_COUNT) make(`meal:${chip}`, 'meal', `${meal.length} of ${total} ${chip} logs`, 'were within two hours of a meal', meal, total);

    const parts = new Map<string, LogEntry[]>();
    for (const l of withChip) parts.set(partOfDay(l.at), [...(parts.get(partOfDay(l.at)) ?? []), l]);
    for (const [part, inPart] of parts) {
      const n = inPart.length;
      if (n >= MIN_TOTAL && n * 2 >= total) make(`time:${chip}:${part}`, 'time_of_day', `${n} of ${total} ${chip} logs`, `happened ${part}`, inPart, total);
    }
  }

  const chips = chipCounts(logs).map((c) => c.chip);
  for (let i = 0; i < chips.length; i++) {
    for (let j = i + 1; j < chips.length; j++) {
      const a = chips[i];
      const b = chips[j];
      const either = logs.filter((l) => l.chips.includes(a) || l.chips.includes(b)).length;
      const both = logs.filter((l) => l.chips.includes(a) && l.chips.includes(b));
      if (both.length >= MIN_COUNT && either >= MIN_TOTAL) make(`together:${a}:${b}`, 'together', `${a} and ${b}`, `were logged together ${both.length} of ${either} times`, both, either);
    }
  }

  const low = readings.filter((r) => isLowReading(r, thresholds));
  if (low.length >= MIN_TOTAL) {
    for (const [key, text] of Object.entries(SYMPTOM_TEXT)) {
      const withSymptom = low.filter((r) => r.symptoms[key as keyof ReadingEntry['symptoms']]);
      if (withSymptom.length >= MIN_COUNT) make(`reading:${key}`, 'reading', `${withSymptom.length} of ${low.length} low readings`, `came with ${text}`, withSymptom, low.length);
    }
  }
  return out.sort((a, b) => b.count - a.count || b.count / b.total - a.count / a.total);
}
