import { describe, expect, it } from 'vitest';
import { buildBrief } from './brief';
import { chipCounts, computePatterns, DAY_MS } from './patterns';
import type { Thresholds } from './decide';
import type { StepRating } from './ratings';
import type { LogEntry, ReadingEntry } from '../repo/types';
import defaults from '../data/thresholds.json';

const t = defaults as Thresholds;
const now = new Date(2030, 0, 31, 12).getTime();
const log = (chips: string[], ago = 1, ateRecently = false, severity: LogEntry['severity'] = 'moderate'): LogEntry => ({
  id: Math.random().toString(),
  at: now - ago * DAY_MS,
  chips,
  severity,
  ateRecently,
});
const reading = (systolic: number, diastolic: number, symptoms = {}, ago = 1): ReadingEntry => ({
  id: Math.random().toString(),
  at: now - ago * DAY_MS,
  systolic,
  diastolic,
  pulse: 70,
  temperature: null,
  symptoms,
  situation: null,
  cardId: null,
});

describe('computePatterns', () => {
  it('returns nothing with too little data', () => {
    expect(computePatterns([log(['Dizzy'], 1, true)], [], t, now)).toEqual([]);
  });
  it('counts logs within two hours of a meal', () => {
    const logs = [log(['Dizzy'], 1, true), log(['Dizzy'], 2, true), log(['Dizzy'], 3)];
    const p = computePatterns(logs, [], t, now).find((x) => x.kind === 'meal');
    expect(p).toMatchObject({ count: 2, total: 3, headline: '2 of 3 Dizzy logs' });
  });
  it('counts symptoms logged together', () => {
    const logs = [log(['Dizzy', 'Nausea']), log(['Dizzy', 'Nausea']), log(['Dizzy'])];
    const p = computePatterns(logs, [], t, now).find((x) => x.kind === 'together');
    expect(p).toMatchObject({ count: 2, total: 3, label: 'Association' });
  });
  it('counts symptoms that came with low readings', () => {
    const rs = [reading(85, 55, { diarrhea: true }), reading(85, 55, { diarrhea: true }), reading(85, 55)];
    expect(computePatterns([], rs, t, now)[0]).toMatchObject({ kind: 'reading', count: 2, total: 3 });
  });
  it('ignores anything older than 30 days', () => {
    const logs = [log(['Dizzy', 'Nausea'], 40), log(['Dizzy', 'Nausea'], 40), log(['Dizzy'], 40)];
    expect(computePatterns(logs, [], t, now)).toEqual([]);
  });
  it('is always labeled association and never claims a cause or diagnosis', () => {
    const logs = [log(['Dizzy', 'Nausea'], 1, true), log(['Dizzy', 'Nausea'], 2, true), log(['Dizzy'], 3)];
    const ps = computePatterns(logs, [], t, now);
    expect(ps.length).toBeGreaterThan(0);
    for (const p of ps) {
      expect(p.label).toBe('Association');
      expect(`${p.headline} ${p.detail}`).not.toMatch(/caus|diagnos|because|due to/i);
    }
  });
});

describe('chipCounts', () => {
  it('counts each chip once per log and sorts by count', () => {
    expect(chipCounts([log(['A', 'A', 'B']), log(['B'])])).toEqual([
      { chip: 'B', count: 2 },
      { chip: 'A', count: 1 },
    ]);
  });
});

describe('buildBrief', () => {
  const rating = (over: Partial<StepRating>): StepRating => ({
    id: Math.random().toString(),
    cardId: 'gone-card',
    stepId: 's',
    rating: 'helped',
    at: now - DAY_MS,
    stepText: 'text',
    cardTitle: 'Old card',
    safety: false,
    ...over,
  });
  it('counts the last 30 days only', () => {
    const b = buildBrief(
      {
        logs: [log(['Dizzy']), log(['Dizzy'], 45), log(['Nausea'], 2, false, 'severe')],
        readings: [reading(85, 55), reading(190, 125), reading(85, 55, {}, 45)],
        ratings: [],
        questions: [],
      },
      t,
      now,
    );
    expect(b.counts).toEqual(
      expect.arrayContaining([
        { label: 'Dizzy logs', count: 1 },
        { label: 'logs marked severe', count: 1 },
        { label: 'readings below 90/60', count: 1 },
        { label: 'readings above 180/120', count: 1 },
      ]),
    );
  });
  it('flags made it worse, including safety steps and cards that no longer exist', () => {
    const b = buildBrief(
      {
        logs: [],
        readings: [],
        questions: [],
        ratings: [rating({ rating: 'made_worse', safety: true }), rating({ stepId: 'x', rating: 'helped' })],
      },
      t,
      now,
    );
    expect(b.worse).toHaveLength(1);
    expect(b.otherRatings).toHaveLength(1);
  });
  it('a later rating clears the worse flag', () => {
    const b = buildBrief(
      {
        logs: [],
        readings: [],
        questions: [],
        ratings: [rating({ rating: 'made_worse', at: now - 2 * DAY_MS }), rating({ rating: 'helped', at: now - DAY_MS })],
      },
      t,
      now,
    );
    expect(b.worse).toEqual([]);
  });
});
