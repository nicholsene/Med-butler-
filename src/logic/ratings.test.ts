import { describe, expect, it } from 'vitest';
import { applyRatings, latestByStep, type RatingValue, type StepRating } from './ratings';
import type { CardStep } from '../data/card.types';

const step = (id: string, safety = false): CardStep => ({ id, steady: id, warm: id, safety, sources: ['x'] });
const card = { id: 'c1', steps: [step('s0', true), step('a'), step('b'), step('s3', true), step('c')] };
let clock = 0;
const rate = (stepId: string, rating: RatingValue, cardId = 'c1'): StepRating => ({
  id: `${++clock}`,
  cardId,
  stepId,
  rating,
  at: clock,
  stepText: stepId,
  cardTitle: cardId,
  safety: stepId.startsWith('s'),
});
const ids = (ratings: StepRating[]) => applyRatings(card, ratings).visible.map((s) => s.id);

describe('applyRatings', () => {
  it('keeps card order with no ratings', () => {
    expect(ids([])).toEqual(['s0', 'a', 'b', 's3', 'c']);
  });
  it('moves helped steps up among non-safety steps', () => {
    expect(ids([rate('c', 'helped')])).toEqual(['s0', 'c', 'a', 's3', 'b']);
  });
  it("moves didn't help and not now down, with didn't help last", () => {
    expect(ids([rate('a', 'didnt_help'), rate('b', 'not_now')])).toEqual(['s0', 'c', 'b', 's3', 'a']);
  });
  it('made it worse hides the step for that card', () => {
    const { visible, hidden } = applyRatings(card, [rate('a', 'made_worse')]);
    expect(hidden.map((s) => s.id)).toEqual(['a']);
    expect(visible.map((s) => s.id)).toEqual(['s0', 'b', 'c', 's3']);
  });
  it('a rating on another card has no effect', () => {
    expect(ids([rate('a', 'made_worse', 'other'), rate('c', 'helped', 'other')])).toEqual(['s0', 'a', 'b', 's3', 'c']);
  });
  it('the latest rating wins, so a step can come back', () => {
    expect(ids([rate('a', 'made_worse'), rate('a', 'helped')])).toEqual(['s0', 'a', 'b', 's3', 'c']);
  });
  it('ignores ratings for step ids the card no longer has', () => {
    expect(ids([rate('gone', 'made_worse')])).toEqual(['s0', 'a', 'b', 's3', 'c']);
  });
});

describe('safety steps are immune', () => {
  it.each(['helped', 'didnt_help', 'made_worse', 'not_now'] as RatingValue[])('%s does not move or hide a safety step', (r) => {
    const { visible, hidden } = applyRatings(card, [rate('s0', r), rate('s3', r)]);
    expect(visible.map((s) => s.id)).toEqual(['s0', 'a', 'b', 's3', 'c']);
    expect(hidden).toEqual([]);
  });
  it('stay at their position when other steps reorder', () => {
    const out = ids([rate('c', 'helped'), rate('a', 'didnt_help')]);
    expect(out[0]).toBe('s0');
    expect(out[3]).toBe('s3');
  });
  it('survive every other step being hidden', () => {
    const out = ids([rate('a', 'made_worse'), rate('b', 'made_worse'), rate('c', 'made_worse')]);
    expect(out).toEqual(['s0', 's3']);
  });
  it('a helpful rating on a non-safety step never passes a leading safety step', () => {
    expect(ids([rate('c', 'helped')])[0]).toBe('s0');
  });
});

describe('latestByStep', () => {
  it('keys by card and step when no card is given', () => {
    expect(latestByStep([rate('a', 'helped', 'c1'), rate('a', 'not_now', 'c2')]).size).toBe(2);
  });
});
