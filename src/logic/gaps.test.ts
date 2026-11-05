import { describe, expect, it } from 'vitest';
import { computeGaps, dayText, LOOKBACK_DAYS, symptomRows, visitTime, type GapInput, type GapItem } from './gaps';
import { DAY_MS } from './patterns';
import type { Thresholds } from './decide';
import type { StepRating } from './ratings';
import type { Doctor, LogEntry, ReadingEntry, ToldMark, Visit } from '../repo/types';
import defaults from '../data/thresholds.json';

const now = new Date(2030, 5, 15, 12).getTime();
const ago = (d: number) => now - d * DAY_MS;
let n = 0;
const id = () => `id${n++}`;

const log = (chip: string | string[], d: number, over: Partial<LogEntry> = {}): LogEntry => ({
  id: id(),
  at: ago(d),
  chips: Array.isArray(chip) ? chip : [chip],
  severity: 'moderate',
  ateRecently: false,
  ...over,
});
const reading = (systolic: number, diastolic: number, d: number, pulse = 70): ReadingEntry => ({
  id: id(),
  at: ago(d),
  systolic,
  diastolic,
  pulse,
  temperature: null,
  symptoms: {},
  situation: null,
  cardId: null,
});
const A: Doctor = { id: 'a', role: 'Role A' };
const B: Doctor = { id: 'b', role: 'Role B' };
const visit = (doctorId: string, d: number, symptomsDiscussed: string[] = [], medications: string[] | null = null): Visit => ({
  id: id(),
  doctorId,
  at: ago(d),
  symptomsDiscussed,
  notes: '',
  medications,
});
const mark = (topic: string, d: number, doctorId: string | null = null): ToldMark => ({ id: id(), topic, at: ago(d), doctorId });
const rating = (over: Partial<StepRating> = {}): StepRating => ({
  id: id(),
  cardId: 'c',
  stepId: 's',
  rating: 'made_worse',
  at: ago(5),
  stepText: 'Step text',
  cardTitle: 'Card title',
  safety: false,
  ...over,
});
const input = (over: Partial<GapInput>): GapInput => ({
  logs: [],
  readings: [],
  ratings: [],
  doctors: [],
  visits: [],
  marks: [],
  medications: [],
  thresholds: defaults as Thresholds,
  ...over,
});
const gaps = (over: Partial<GapInput>, kind?: GapItem['kind']) => {
  const all = computeGaps(input(over), now);
  return kind ? all.filter((g) => g.kind === kind) : all;
};

describe('with no gap, nothing shows', () => {
  it('returns nothing for empty data', () => expect(gaps({})).toEqual([]));
  it('returns nothing when everything has been discussed recently', () => {
    expect(gaps({ logs: [log('X', 3), log('X', 2)], doctors: [A], visits: [visit('a', 1, ['X'])] })).toEqual([]);
  });
});

describe('never discussed', () => {
  it('flags a symptom with no visit or mark, with its count and dates', () => {
    const [g, ...rest] = gaps({ logs: [log('X', 10), log('X', 3)] }, 'never_discussed');
    expect(rest).toEqual([]);
    expect(g.count).toBe(2);
    expect(g.dates).toEqual([ago(10), ago(3)]);
    expect(g.evidence.join(' ')).toContain('2 times');
    expect(g.evidence.join(' ')).toContain(dayText(ago(10)));
    expect(g.evidence.join(' ')).toContain(dayText(ago(3)));
  });
  it('one ordinary log is not enough', () => expect(gaps({ logs: [log('X', 3)] })).toEqual([]));
  it('one severe log is enough', () => expect(gaps({ logs: [log('X', 3, { severity: 'severe' })] }, 'never_discussed')).toHaveLength(1));
  it('a told mark clears it, ignoring case and spacing', () => {
    expect(gaps({ logs: [log('Sample Thing', 3), log('Sample Thing', 2)], marks: [mark(' sample  thing ', 1)] }, 'never_discussed')).toEqual([]);
  });
  it('a visit clears it', () => {
    expect(gaps({ logs: [log('X', 3), log('X', 2)], doctors: [A], visits: [visit('a', 1, ['x'])] }, 'never_discussed')).toEqual([]);
  });
  it('a future-dated visit does not count', () => {
    expect(gaps({ logs: [log('X', 3), log('X', 2)], doctors: [A], visits: [visit('a', -5, ['X'])] }, 'never_discussed')).toHaveLength(1);
  });
  it('ignores logs older than the lookback', () => {
    expect(gaps({ logs: [log('X', LOOKBACK_DAYS + 1), log('X', LOOKBACK_DAYS + 2)] })).toEqual([]);
  });
  it('counts readings outside the limits, using the saved thresholds', () => {
    const [g] = gaps({ readings: [reading(85, 55, 4), reading(85, 55, 2)] }, 'never_discussed');
    expect(g).toMatchObject({ title: 'Low readings', count: 2 });
    expect(gaps({ readings: [reading(120, 80, 4), reading(120, 80, 2)] })).toEqual([]);
  });
  it('one very high reading is enough', () => {
    expect(gaps({ readings: [reading(190, 125, 4)] }, 'never_discussed')[0]).toMatchObject({ title: 'Very high readings' });
  });
});

describe('changed since last discussed', () => {
  const base = { doctors: [A], visits: [visit('a', 20, ['X'])] };
  // Window is 20 days each side of the visit. An entry 45 days ago marks when logging began.
  const start = log('Other', 45);

  it('flags a rise over the same length of time, with both counts', () => {
    const logs = [start, log('X', 25), log('X', 15), log('X', 10), log('X', 5), log('X', 2)];
    const [g] = gaps({ ...base, logs }, 'changed');
    expect(g.count).toBe(4);
    expect(g.summary).toContain('more often');
    expect(g.evidence[0]).toContain('The 20 days before');
    expect(g.evidence[0]).toContain('1 time');
    expect(g.evidence[1]).toContain('The latest 20 days');
    expect(g.evidence[1]).toContain('4 times');
    expect(g.dates).toHaveLength(5);
  });
  it('flags a clear fall', () => {
    const logs = [start, log('X', 40), log('X', 35), log('X', 30), log('X', 25), log('X', 5)];
    expect(gaps({ ...base, logs }, 'changed')[0].summary).toContain('less often');
  });
  it('is quiet when the frequency is about the same', () => {
    const logs = [start, log('X', 30), log('X', 25), log('X', 10), log('X', 5)];
    expect(gaps({ ...base, logs }, 'changed')).toEqual([]);
  });
  it('a rise of one is not enough', () => {
    const logs = [start, log('X', 25), log('X', 10), log('X', 5)];
    expect(gaps({ ...base, logs }, 'changed')).toEqual([]);
  });
  it('is quiet when the last discussion is under a week old', () => {
    const logs = [start, log('X', 5), log('X', 4), log('X', 3), log('X', 2), log('X', 1)];
    expect(gaps({ doctors: [A], visits: [visit('a', 6, ['X'])], logs }, 'changed')).toEqual([]);
  });
  it('does not treat the time before logging began as zero', () => {
    // Told at a visit just as she started logging. There's nothing to compare against.
    const logs = [log('X', 19), log('X', 15), log('X', 10), log('X', 5), log('X', 2)];
    expect(gaps({ ...base, logs }, 'changed')).toEqual([]);
  });
  it('shrinks both windows to what was logged', () => {
    const logs = [log('Other', 30), log('X', 15), log('X', 5), log('X', 4), log('X', 3)];
    const [g] = gaps({ ...base, logs }, 'changed');
    expect(g.evidence[0]).toContain('The 10 days before');
    expect(g.evidence[1]).toContain('The latest 10 days');
  });
  it('a newer told mark resets the comparison', () => {
    const logs = [start, log('X', 25), log('X', 15), log('X', 10), log('X', 5), log('X', 2)];
    expect(gaps({ ...base, logs, marks: [mark('X', 1)] }, 'changed')).toEqual([]);
  });
  it('does not also report it as never discussed', () => {
    const logs = [start, log('X', 25), log('X', 15), log('X', 10), log('X', 5), log('X', 2)];
    expect(gaps({ ...base, logs }, 'never_discussed').filter((g) => g.title === 'X')).toEqual([]);
  });
});

describe('pattern not raised', () => {
  const logs = [log(['X', 'Y'], 5), log(['X', 'Y'], 4), log('X', 3)];
  it('flags a pattern with its count and dates', () => {
    const g = gaps({ logs }, 'pattern_not_raised').find((x) => x.id.startsWith('pattern:together'))!;
    expect(g.count).toBe(2);
    expect(g.dates).toEqual([ago(5), ago(4)]);
    expect(g.evidence.join(' ')).toContain('2 of 3');
    expect(g.evidence.join(' ')).toContain(dayText(ago(5)));
  });
  it('a mark on the pattern clears it', () => {
    const [g] = gaps({ logs }, 'pattern_not_raised');
    expect(gaps({ logs, marks: [mark(g.topic, 1)] }, 'pattern_not_raised').map((x) => x.id)).not.toContain(g.id);
  });
});

describe('known to one doctor and not another', () => {
  const logs = [log('X', 3), log('X', 2)];
  it('names who has it on record and who does not', () => {
    const [g] = gaps({ logs, doctors: [A, B], visits: [visit('a', 1, ['X'])] }, 'known_to_one');
    expect(g.summary).toContain('with Role B');
    expect(g.evidence.join(' ')).toContain(`Role A (${dayText(ago(1))})`);
    expect(g.evidence.join(' ')).toContain('Nothing recorded here with: Role B');
    expect(g.doctorIds).toEqual(['b']);
  });
  it('a mark with the other doctor clears it', () => {
    expect(gaps({ logs, doctors: [A, B], visits: [visit('a', 1, ['X'])], marks: [mark('X', 1, 'b')] }, 'known_to_one')).toEqual([]);
  });
  it('a mark naming no doctor is not counted for anyone', () => {
    expect(gaps({ logs, doctors: [A, B], marks: [mark('X', 1)] }, 'known_to_one')).toEqual([]);
  });
  it('needs two doctors', () => {
    expect(gaps({ logs, doctors: [A], visits: [visit('a', 1, ['X'])] }, 'known_to_one')).toEqual([]);
  });
  it('is quiet for a symptom not logged in the lookback', () => {
    const old = [log('X', LOOKBACK_DAYS + 5)];
    expect(gaps({ logs: old, doctors: [A, B], visits: [visit('a', 1, ['X'])] }, 'known_to_one')).toEqual([]);
  });
});

describe('rating not shared', () => {
  it('flags a rating with its date', () => {
    const [g] = gaps({ ratings: [rating()] }, 'rating_not_shared');
    expect(g.evidence[0]).toContain(dayText(ago(5)));
    expect(g.evidence[0]).toContain('Made it worse');
  });
  it('does not flag "not now"', () => expect(gaps({ ratings: [rating({ rating: 'not_now' })] })).toEqual([]));
  it('a mark after the rating clears it, one before does not', () => {
    const topic = 'rating:c|s';
    expect(gaps({ ratings: [rating()], marks: [mark(topic, 1)] }, 'rating_not_shared')).toEqual([]);
    expect(gaps({ ratings: [rating()], marks: [mark(topic, 9)] }, 'rating_not_shared')).toHaveLength(1);
  });
  it('uses the latest rating for a step', () => {
    const r = [rating({ at: ago(9) }), rating({ at: ago(1), rating: 'helped' })];
    const out = gaps({ ratings: r }, 'rating_not_shared');
    expect(out).toHaveLength(1);
    expect(out[0].evidence[0]).toContain('Helped');
  });
  it('puts "made it worse" first', () => {
    const r = [rating({ stepId: 'h', rating: 'helped' }), rating({ stepId: 'w', rating: 'made_worse' })];
    expect(gaps({ ratings: r }, 'rating_not_shared').map((g) => g.id)).toEqual(['rating:c|w', 'rating:c|h']);
  });
});

describe('possible medication list mismatch', () => {
  const doctors = [A];
  it('lists what differs and the visit date', () => {
    const [g] = gaps({ doctors, medications: ['Sample one', 'Sample two'], visits: [visit('a', 5, [], ['Sample one', 'Sample three'])] }, 'medication_mismatch');
    expect(g.count).toBe(2);
    expect(g.evidence.join(' ')).toContain('Only on your list: Sample two');
    expect(g.evidence.join(' ')).toContain('Only on the visit list: Sample three');
    expect(g.dates).toEqual([ago(5)]);
  });
  it('is quiet when the lists match, ignoring case', () => {
    expect(gaps({ doctors, medications: ['Sample one'], visits: [visit('a', 5, [], ['sample ONE'])] }, 'medication_mismatch')).toEqual([]);
  });
  it('treats a different dose as written differently, not as missing', () => {
    const [g] = gaps({ doctors, medications: ['Sample 10 mg'], visits: [visit('a', 5, [], ['Sample 20 mg'])] }, 'medication_mismatch');
    expect(g.evidence.join(' ')).toContain('Written differently: Sample 10 mg / Sample 20 mg');
    expect(g.evidence.join(' ')).not.toContain('Only on');
  });
  it('is quiet when no list was recorded, or her list is empty', () => {
    expect(gaps({ doctors, medications: ['Sample'], visits: [visit('a', 5)] }, 'medication_mismatch')).toEqual([]);
    expect(gaps({ doctors, medications: [], visits: [visit('a', 5, [], ['Sample'])] }, 'medication_mismatch')).toEqual([]);
  });
  it('uses the newest list from each doctor', () => {
    const visits = [visit('a', 9, [], ['Old']), visit('a', 5, [], ['Sample']), visit('a', 2)];
    expect(gaps({ doctors, medications: ['Sample'], visits }, 'medication_mismatch')).toEqual([]);
  });
  it('a mark clears it until the differences change', () => {
    const visits = [visit('a', 5, [], ['Other'])];
    const [g] = gaps({ doctors, medications: ['Sample'], visits }, 'medication_mismatch');
    expect(gaps({ doctors, medications: ['Sample'], visits, marks: [mark(g.topic, 1)] }, 'medication_mismatch')).toEqual([]);
    expect(gaps({ doctors, medications: ['Sample', 'Added'], visits, marks: [mark(g.topic, 1)] }, 'medication_mismatch')).toHaveLength(1);
  });
});

describe('wording', () => {
  const everything = input({
    logs: [log(['X', 'Y'], 40), log(['X', 'Y'], 30), log(['X', 'Y'], 25), log(['Q', 'R'], 5), log(['Q', 'R'], 4), log('Q', 3)],
    readings: [reading(85, 55, 4), reading(85, 55, 2), reading(190, 125, 1)],
    ratings: [rating(), rating({ stepId: 't', rating: 'didnt_help' }), rating({ stepId: 'u', rating: 'helped' })],
    doctors: [A, B],
    visits: [visit('a', 8, ['X'], ['Other']), visit('b', 7, ['Y'])],
    medications: ['Sample'],
  });
  const items = computeGaps(everything, now);

  it('covers every kind of flag in this fixture', () => {
    expect(new Set(items.map((g) => g.kind)).size).toBe(5);
  });
  it('every item says it may be worth raising', () => {
    for (const g of items) {
      expect(g.summary.toLowerCase()).toContain('may be worth raising');
      expect(g.briefText.toLowerCase()).toContain('may be worth raising');
    }
  });
  it('every item carries a count and at least one date', () => {
    for (const g of items) {
      expect(g.count).toBeGreaterThan(0);
      expect(g.dates.length).toBeGreaterThan(0);
      expect(g.evidence.length).toBeGreaterThan(0);
    }
  });
  it('never says a doctor missed something or got something wrong', () => {
    const banned = /miss|fail|neglect|ignor|overlook|forgot|should have|wrong|mistake|error|did ?n[o']t|has ?n[o']t|unaware|never told|dismiss/i;
    // "Didn't help" is the app's own label for her rating of a step, and isn't about a doctor.
    const text = (g: GapItem) => `${g.title} ${g.summary} ${g.evidence.join(' ')} ${g.briefText}`.replaceAll(`Didn't help`, '');
    for (const g of items) expect(text(g)).not.toMatch(banned);
  });
});

describe('symptomRows', () => {
  it('lists symptoms with the last time each came up', () => {
    const rows = symptomRows(input({ logs: [log('X', 5), log('X', 4), log('Y', 3)], doctors: [A], marks: [mark('Y', 1)] }), now);
    expect(rows).toEqual([
      { label: 'X', count: 2, lastDiscussedAt: null },
      { label: 'Y', count: 1, lastDiscussedAt: ago(1) },
    ]);
  });
});

describe('visitTime', () => {
  const morning = new Date(2030, 5, 15, 9).getTime();
  it('uses noon on an earlier day', () => expect(visitTime('2030-06-10', morning)).toBe(new Date(2030, 5, 10, 12).getTime()));
  it('never lands in the future on the same day', () => expect(visitTime('2030-06-15', morning)).toBe(morning));
  it('rejects a future date or nonsense', () => {
    expect(visitTime('2030-06-16', morning)).toBeNull();
    expect(visitTime('', morning)).toBeNull();
    expect(visitTime('2030-02-31', morning)).toBeNull();
  });
});
