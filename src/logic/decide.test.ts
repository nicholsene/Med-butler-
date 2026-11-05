import { describe, expect, it } from 'vitest';
import { decide, validateThresholds, type DecideInput, type Routing, type Thresholds } from './decide';
import defaults from '../data/thresholds.json';

const t = defaults as Thresholds;
const routing: Routing = {
  very_high_bp: 'high-card',
  low_bp: 'low-card',
  low_bp_fluid_loss: 'low-fluid-card',
  possible_low_sugar: 'sugar-card',
};
const run = (input: DecideInput, r = routing, known?: string[]) => decide(input, t, r, known);

describe('defaults', () => {
  it('match the agreed defaults', () => {
    expect(t.lowBp).toEqual({ systolicBelow: 90, diastolicBelow: 60 });
    expect(t.veryHighBp).toEqual({ systolicAbove: 180, diastolicAbove: 120, recheckMinutes: 1 });
    expect(t.restingPulse).toEqual({ min: 60, max: 100 });
  });
});

describe('low pressure', () => {
  it.each([
    [89, 70],
    [100, 59],
    [88, 56],
  ])('%i/%i selects the low card', (systolic, diastolic) => {
    expect(run({ systolic, diastolic })).toMatchObject({ kind: 'card', cardId: 'low-card', situation: 'low_bp' });
  });
  it('90/60 exactly is not low', () => {
    expect(run({ systolic: 90, diastolic: 60 })).toMatchObject({ kind: 'none', reason: 'in_range' });
  });
  it.each(['diarrhea', 'vomiting', 'darkUrine'] as const)('adds possible fluid loss with %s', (key) => {
    expect(run({ systolic: 88, diastolic: 56, symptoms: { [key]: true } })).toMatchObject({
      kind: 'card',
      cardId: 'low-fluid-card',
      label: 'Low pressure, possible fluid loss',
    });
  });
});

describe('180/120 path', () => {
  it('180/120 exactly is not very high', () => {
    expect(run({ systolic: 180, diastolic: 120 })).toMatchObject({ kind: 'none', reason: 'in_range' });
  });
  it.each([
    [181, 80],
    [150, 121],
    [190, 130],
  ])('%i/%i asks for a 1-minute recheck first and gives no card', (systolic, diastolic) => {
    const d = run({ systolic, diastolic });
    expect(d).toMatchObject({ kind: 'recheck', minutes: 1, situation: 'very_high_bp' });
    expect(d).not.toHaveProperty('cardId');
  });
  it('still very high on the second reading selects the card', () => {
    expect(run({ systolic: 190, diastolic: 125, alreadyRechecked: true })).toMatchObject({
      kind: 'card',
      cardId: 'high-card',
    });
  });
  it('a second reading back in range does not select the card', () => {
    expect(run({ systolic: 150, diastolic: 90, alreadyRechecked: true })).toMatchObject({
      kind: 'none',
      reason: 'in_range',
    });
  });
  it('very high outranks low and symptoms', () => {
    expect(run({ systolic: 190, diastolic: 55, symptoms: { shakySweaty: true } }).kind).toBe('recheck');
  });
  it('uses edited thresholds', () => {
    const edited = { ...t, veryHighBp: { ...t.veryHighBp, systolicAbove: 170, recheckMinutes: 2 } };
    expect(decide({ systolic: 175, diastolic: 80 }, edited, routing)).toMatchObject({ kind: 'recheck', minutes: 2 });
  });
});

describe('low blood sugar is only ever possible, and only from symptoms', () => {
  it('shaky or sweaty selects the possible card', () => {
    expect(run({ symptoms: { shakySweaty: true } })).toMatchObject({
      kind: 'card',
      cardId: 'sugar-card',
      label: 'Possible low blood sugar',
    });
  });
  it('readings alone never select it', () => {
    for (const systolic of [70, 100, 150]) {
      const d = run({ systolic, diastolic: 50, pulse: 120 });
      expect(d.kind === 'card' ? d.situation : '').not.toBe('possible_low_sugar');
    }
  });
  it('hunger alone does not select it', () => {
    expect(run({ symptoms: { veryHungry: true } })).toMatchObject({ kind: 'none', reason: 'no_match' });
  });
  it('is a flag, not the card, when pressure is the main finding', () => {
    expect(run({ systolic: 85, diastolic: 55, symptoms: { shakySweaty: true } })).toMatchObject({
      cardId: 'low-card',
      flags: ['possible_low_sugar'],
    });
  });
  it('routes shaky with vomiting to fluid loss and keeps the sugar flag', () => {
    const r: Routing = { ...routing, fluid_loss: 'fluid-card' };
    expect(run({ symptoms: { shakySweaty: true, vomiting: true } }, r)).toMatchObject({
      cardId: 'fluid-card',
      situation: 'fluid_loss',
      flags: ['possible_low_sugar'],
    });
  });
  it('every label that mentions sugar says possible', () => {
    const inputs: DecideInput[] = [
      { symptoms: { shakySweaty: true } },
      { symptoms: { shakySweaty: true, veryHungry: true, ateRecently: true } },
      { systolic: 120, diastolic: 80, symptoms: { shakySweaty: true } },
    ];
    for (const input of inputs) expect(JSON.stringify(run(input))).toMatch(/Possible low blood sugar/);
  });
});

describe('pulse and temperature', () => {
  it.each([
    [101, 'pulse_high'],
    [59, 'pulse_low'],
  ])('pulse %i is flagged', (pulse, flag) => {
    expect(run({ systolic: 85, diastolic: 55, pulse }).flags).toContain(flag);
  });
  it.each([60, 100])('pulse %i is in range', (pulse) => {
    expect(run({ systolic: 85, diastolic: 55, pulse }).flags).toEqual([]);
  });
  it('pulse alone selects no card', () => {
    expect(run({ pulse: 130 })).toMatchObject({ kind: 'none', reason: 'no_match', flags: ['pulse_high'] });
  });
  it('temperature never changes the outcome', () => {
    const base = { systolic: 120, diastolic: 80 };
    expect(run({ ...base, temperature: 104 })).toEqual(run(base));
  });
});

describe('no card output', () => {
  it('nothing entered', () => {
    expect(run({})).toEqual({ kind: 'none', reason: 'no_input', flags: [] });
  });
  it('unsupported situation with no routed card', () => {
    const d = run({ symptoms: { diarrhea: true } });
    expect(d).toMatchObject({ kind: 'none', reason: 'no_card', situation: 'fluid_loss' });
    expect(d).not.toHaveProperty('cardId');
  });
  it('routed card id missing from the loaded cards', () => {
    expect(run({ systolic: 85, diastolic: 55 }, routing, ['something-else'])).toMatchObject({
      kind: 'none',
      reason: 'no_card',
      situation: 'low_bp',
    });
  });
  it.each([
    [{ systolic: 56, diastolic: 88 }],
    [{ systolic: 900, diastolic: 80 }],
    [{ pulse: 600 }],
  ])('implausible numbers %j', (input) => {
    expect(run(input)).toMatchObject({ kind: 'none', reason: 'implausible' });
  });
});

describe('validateThresholds', () => {
  it('accepts the defaults', () => expect(validateThresholds(t)).toEqual([]));
  it('rejects inverted pulse and non-numbers', () => {
    expect(validateThresholds({ ...t, restingPulse: { min: 100, max: 60 } })).toHaveLength(1);
    expect(validateThresholds({ ...t, guideRecheckMinutes: Number.NaN })).toHaveLength(1);
  });
});
