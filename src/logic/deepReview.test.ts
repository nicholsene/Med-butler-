import { describe, expect, it } from 'vitest';
import { buildDeepReview, describeDeepReview, scrubText } from './deepReview';
import { findContactPatterns } from './contactPatterns.mjs';
import { defaultSettings } from '../data/defaults';
import type { AppData } from '../repo/types';

const now = new Date(2030, 5, 15, 12).getTime();
const DAY = 86_400_000;

// Fictional details: reserved 555-01xx numbers, example.com, invented names.
const PHONE_A = '555-555-0100';
const PHONE_B = '(555) 555-0101';
const data = (): AppData => {
  const base = defaultSettings();
  return {
    settings: {
      ...base,
      setupComplete: true,
      name: 'Testa Person',
      conditions: ['SAMPLE condition'],
      medications: ['SAMPLE medication'],
      phones: { contactA: PHONE_A, contactB: PHONE_B },
      labels: { ...base.labels, contactA: 'Quillon', contactB: 'Marrow' },
    },
    timers: { secretTimer: 5 },
    logs: [
      { id: 'uuid-log-1', at: now - DAY, chips: ['SAMPLE symptom'], severity: 'mild', ateRecently: false },
      { id: 'uuid-log-2', at: now - 2 * DAY, chips: ['SAMPLE symptom'], severity: 'mild', ateRecently: false },
    ],
    readings: [
      { id: 'uuid-r', at: now - DAY, systolic: 120, diastolic: 80, pulse: 70, temperature: null, symptoms: {}, situation: null, cardId: null },
    ],
    ratings: [],
    questions: [{ id: 'uuid-q', text: `Ask Quillon about it, call ${PHONE_B}`, at: now - DAY, cardId: null }],
    prep: [{ id: 'p', cardId: 'c', location: 'SECRET-KIT', item: 'x', have: true, custom: true }],
    shopping: [{ id: 's', name: 'SECRET-SHOP', done: false, prepId: null }],
    doctors: [{ id: 'uuid-doc', role: 'Dr. Smithson, primary care' }],
    visits: [
      {
        id: 'uuid-visit',
        doctorId: 'uuid-doc',
        at: now - 3 * DAY,
        symptomsDiscussed: ['SAMPLE other'],
        notes: `Dr. Smithson said to call ${PHONE_A} or write to someone@example.com. Marrow drove.`,
        medications: null,
      },
    ],
    marks: [],
  };
};

describe('buildDeepReview', () => {
  const text = (includeNotes = false) => JSON.stringify(buildDeepReview(data(), { includeNotes }, now));

  it.each([[false], [true]])('leaves out names, numbers and contact details (notes included: %s)', (notes) => {
    const out = text(notes);
    for (const secret of ['Testa', 'Person', 'Quillon', 'Marrow', 'Smithson', '555', 'example.com']) expect(out).not.toContain(secret);
    expect(findContactPatterns(out)).toEqual([]);
  });
  it('leaves out IDs, timers, kits and shopping', () => {
    const out = text(true);
    for (const secret of ['uuid-', 'secretTimer', 'SECRET-KIT', 'SECRET-SHOP']) expect(out).not.toContain(secret);
  });
  it('keeps the health data that a review is for', () => {
    const r = buildDeepReview(data(), { includeNotes: false }, now);
    expect(r.conditions).toEqual(['SAMPLE condition']);
    expect(r.medications).toEqual(['SAMPLE medication']);
    expect(r.logs).toHaveLength(2);
    expect(r.readings[0].systolic).toBe(120);
    expect(r.gapReview.length).toBeGreaterThan(0);
    expect(r.doctors[0].role).toContain('primary care');
  });
  it('leaves notes out unless asked', () => {
    expect(buildDeepReview(data(), { includeNotes: false }, now).visits[0].notes).toBeUndefined();
    const withNotes = buildDeepReview(data(), { includeNotes: true }, now).visits[0].notes;
    expect(withNotes).toContain('said to call');
    expect(withNotes).toContain('[contact removed]');
    expect(withNotes).toContain('[name removed]');
  });
  it('resolves visits to a role, and survives a doctor no longer listed', () => {
    const d = data();
    d.doctors = [];
    expect(buildDeepReview(d, { includeNotes: false }, now).visits[0].doctor).toBe('Doctor no longer listed');
  });
  it('works with no settings', () => {
    const d = data();
    d.settings = null;
    expect(buildDeepReview(d, { includeNotes: false }, now).gapReview).toEqual([]);
  });
  it('reports its contents, and notes only when included', () => {
    const count = (notes: boolean) => describeDeepReview(buildDeepReview(data(), { includeNotes: notes }, now)).find((c) => c.label === 'Visit notes')?.count;
    expect(count(false)).toBe(0);
    expect(count(true)).toBe(1);
  });
});

describe('scrubText', () => {
  it('matches a saved name whole, in any case', () => {
    expect(scrubText('ask ANNA now', ['Anna'])).toBe('ask [name removed] now');
    expect(scrubText('Annalise and manna stay', ['Anna'])).toBe('Annalise and manna stay');
  });
  it('handles names with regex characters and accents', () => {
    expect(scrubText('with Jo(e) today', ['Jo(e)'])).toBe('with [name removed] today');
    expect(scrubText('with José today', ['José'])).toBe('with [name removed] today');
  });
  it('catches a title and surname with no saved name', () => {
    expect(scrubText('Saw Dr. Sample today', [])).toBe('Saw [name removed] today');
  });
});
