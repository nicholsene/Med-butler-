import { describe, expect, it } from 'vitest';
import { validateCard, validateCards } from './cardValidator';
import cards from '../data/cards.json';
import sources from '../data/sources.json';
import routing from '../data/routing.json';

const good = () => structuredClone(cards[0]) as unknown as Record<string, any>;

describe('validateCard', () => {
  it('accepts a complete card', () => expect(validateCard(good(), sources)).toEqual([]));

  it.each([[[]], [undefined], ['cc_src1']])('rejects a step with sources = %j', (value) => {
    const card = good();
    card.steps[1].sources = value;
    expect(validateCard(card, sources).join()).toMatch(/step 2 has no sources/);
  });
  it('rejects a safety step with no sources too', () => {
    const card = good();
    card.steps[0].sources = [];
    expect(validateCard(card, sources).join()).toMatch(/step 1 has no sources/);
  });
  it('rejects an unknown source id', () => {
    const card = good();
    card.steps[0].sources = ['nope'];
    expect(validateCard(card, sources).join()).toMatch(/unknown source "nope"/);
  });
  it('rejects an emergency item with no sources', () => {
    const card = good();
    card.emergency[0].sources = [];
    expect(validateCard(card, sources).join()).toMatch(/emergency 1 has no sources/);
  });
  it('rejects a missing voice, bad status and bad strength', () => {
    const card = good();
    delete card.steps[0].warm;
    card.status = 'approved';
    card.evidence.strength = 'great';
    const out = validateCard(card, sources).join();
    expect(out).toMatch(/no warm text/);
    expect(out).toMatch(/status/);
    expect(out).toMatch(/evidence/);
  });
  it('rejects repeated step ids', () => {
    const card = good();
    card.steps[1].id = card.steps[0].id;
    expect(validateCard(card, sources).join()).toMatch(/repeats id/);
  });
  it('rejects an avoid or call-doctor item with no sources', () => {
    for (const key of ['avoid', 'callDoctor'] as const) {
      const card = good();
      card[key] = [{ text: 'Something', sources: [] }];
      expect(validateCard(card, sources).join()).toMatch(new RegExp(`${key} 1 has no sources`));
    }
  });
  it('rejects items with no sources even when no source list is given', () => {
    const card = good();
    card.callDoctor = [{ text: 'Something' }];
    expect(validateCard(card).join()).toMatch(/callDoctor 1 has no sources/);
  });
  it('accepts unverified true or false and rejects anything else', () => {
    const card = good();
    card.emergency[0].unverified = true;
    expect(validateCard(card, sources)).toEqual([]);
    card.emergency[0].unverified = 'yes';
    expect(validateCard(card, sources).join()).toMatch(/unverified must be true or false/);
  });
  it('rejects a card with no emergency items', () => {
    const card = good();
    card.emergency = [];
    expect(validateCard(card, sources).join()).toMatch(/emergency must have at least one item/);
  });
  it('rejects non-objects', () => expect(validateCard(null)).toEqual(['card is not an object']));
});

describe('validateCards', () => {
  it('keeps good cards and reports bad ones without throwing', () => {
    const bad = good();
    bad.id = 'bad';
    bad.steps[0].sources = [];
    const { valid, errors } = validateCards([good(), bad, 7], sources);
    expect(valid).toHaveLength(1);
    expect(errors.map((e) => e.id)).toEqual(['bad', '#3']);
  });
  it('flags duplicates and a non-list file', () => {
    expect(validateCards([good(), good()], sources).errors[0].errors).toEqual(['duplicate card id']);
    expect(validateCards({}).errors[0].id).toBe('(file)');
  });
  it('keeps the id list unique: a repeated id is reported once per extra copy', () => {
    const { valid, errors } = validateCards([good(), good(), good()], sources);
    expect(valid).toHaveLength(1);
    expect(errors).toHaveLength(2);
  });
});

describe('shipped data', () => {
  it('src/data/cards.json is fully valid', () => {
    expect(validateCards(cards, sources).errors).toEqual([]);
  });
  it('every routed card id exists in cards.json', () => {
    const ids = new Set(cards.map((c) => c.id));
    for (const id of Object.values(routing)) expect(ids.has(id)).toBe(true);
  });
});
