import type { Thresholds } from './decide';
import { chipCounts, computePatterns, inWindow, isLowReading, type Pattern } from './patterns';
import { latestByStep, type StepRating } from './ratings';
import type { LogEntry, ReadingEntry, SavedQuestion } from '../repo/types';

export type Brief = {
  counts: { label: string; count: number }[];
  patterns: Pattern[];
  questions: SavedQuestion[];
  worse: StepRating[];
  otherRatings: StepRating[];
};

export function buildBrief(
  data: { logs: LogEntry[]; readings: ReadingEntry[]; ratings: StepRating[]; questions: SavedQuestion[] },
  t: Thresholds,
  now: number,
): Brief {
  const logs = inWindow(data.logs, now, 30);
  const readings = inWindow(data.readings, now, 30);
  const counts = chipCounts(logs).map(({ chip, count }) => ({ label: `${chip} logs`, count }));
  const severe = logs.filter((l) => l.severity === 'severe').length;
  if (severe) counts.push({ label: 'logs marked severe', count: severe });
  const low = readings.filter((r) => isLowReading(r, t)).length;
  if (low) counts.push({ label: `readings below ${t.lowBp.systolicBelow}/${t.lowBp.diastolicBelow}`, count: low });
  const high = readings.filter(
    (r) => (r.systolic ?? 0) > t.veryHighBp.systolicAbove || (r.diastolic ?? 0) > t.veryHighBp.diastolicAbove,
  ).length;
  if (high) counts.push({ label: `readings above ${t.veryHighBp.systolicAbove}/${t.veryHighBp.diastolicAbove}`, count: high });
  const pulse = readings.filter((r) => r.pulse != null && (r.pulse < t.restingPulse.min || r.pulse > t.restingPulse.max)).length;
  if (pulse) counts.push({ label: `pulses outside ${t.restingPulse.min} to ${t.restingPulse.max}`, count: pulse });

  const latest = [...latestByStep(inWindow(data.ratings, now, 30)).values()].sort((a, b) => b.at - a.at);
  return {
    counts,
    patterns: computePatterns(data.logs, data.readings, t, now),
    questions: data.questions.filter((q) => !q.dismissed),
    // "Made it worse" is always flagged, safety steps included, even though those stay visible.
    worse: latest.filter((r) => r.rating === 'made_worse'),
    otherRatings: latest.filter((r) => r.rating !== 'made_worse'),
  };
}
