import { describe, expect, it } from 'vitest';
import cards from '../data/cards.json';
import groups from '../data/groups.json';
import routing from '../data/routing.json';
import sources from '../data/sources.json';
import thresholds from '../data/thresholds.json';
import type { Card } from '../data/card.types';
import { cardsForChips, CARDS, ROUTING } from './cards';
import { decide, type Thresholds } from './decide';
import { chipChoices, groupCards, searchCards, worstOutcome } from './guides';
import { validateCards } from './cardValidator';

const t = thresholds as Thresholds;
const ids = CARDS.map((c) => c.id);
const run = (input: Parameters<typeof decide>[0]) => decide(input, t, ROUTING, ids);

describe('shipped cards', () => {
  it('has 34 valid cards with unique ids and no sample cards', () => {
    expect(validateCards(cards, sources).errors).toEqual([]);
    expect(CARDS).toHaveLength(34);
    expect(new Set(ids).size).toBe(34);
    expect(ids.some((id) => /sample/i.test(id))).toBe(false);
  });
  it('every card group has a plain name', () => {
    const named = new Set(groups.map((g) => g.id));
    for (const c of CARDS) expect(named.has(c.group), `${c.id} group ${c.group}`).toBe(true);
  });
  it('every step, avoid, call-doctor and emergency item cites a known source', () => {
    for (const c of CARDS) {
      for (const item of [...c.steps, ...c.avoid, ...c.callDoctor, ...c.emergency]) {
        expect(item.sources.length).toBeGreaterThan(0);
        for (const s of item.sources) expect(s in sources, `${c.id} cites ${s}`).toBe(true);
      }
      expect(c.emergency.length).toBeGreaterThan(0);
    }
  });
  it('S34 is the very-high-pressure card from one source with a safety 911 step', () => {
    const c = CARDS.find((x) => x.id === 'S34') as Card;
    expect(c.title).toBe('Very high blood pressure reading');
    expect(c.group).toBe('standing');
    expect(c.evidence).toEqual({ reportCount: 0, strength: 'thin' });
    expect(new Set([...c.steps, ...c.avoid, ...c.callDoctor, ...c.emergency].flatMap((x) => x.sources))).toEqual(new Set(['aha_911']));
    expect(c.steps.find((s) => /911/.test(s.steady))?.safety).toBe(true);
  });
  it('the public data names no one and has no forum report ids', () => {
    const text = JSON.stringify(cards);
    expect(text).not.toMatch(/\b(she|her|hers)\b|your colitis|unconfirmed|report id|\b[A-Z]{2}-\d{4}\b|\bkids?\b|daughter|\bgirls\b/i);
  });
});

describe('routing', () => {
  it('sends each situation to its card', () => {
    expect(routing).toMatchObject({ very_high_bp: 'S34', low_bp_fluid_loss: 'S06', low_bp: 'S03', possible_low_sugar: 'S07', fluid_loss: 'S06' });
    expect(run({ systolic: 200, diastolic: 100, alreadyRechecked: true })).toMatchObject({ kind: 'card', cardId: 'S34' });
    expect(run({ systolic: 85, diastolic: 55, symptoms: { vomiting: true } })).toMatchObject({ kind: 'card', cardId: 'S06' });
    expect(run({ systolic: 85, diastolic: 55 })).toMatchObject({ kind: 'card', cardId: 'S03' });
    expect(run({ symptoms: { shakySweaty: true } })).toMatchObject({ kind: 'card', cardId: 'S07' });
    expect(run({ systolic: 120, diastolic: 80, symptoms: { diarrhea: true } })).toMatchObject({ kind: 'card', cardId: 'S06', situation: 'fluid_loss' });
  });
  it('a first very high reading still goes to a recheck', () => {
    expect(run({ systolic: 200, diastolic: 100 }).kind).toBe('recheck');
  });
});

describe('find a guide', () => {
  it('lists all 34 cards across the groups', () => {
    const listed = groupCards(CARDS).flatMap((g) => g.cards.map((c) => c.id));
    expect(listed.sort()).toEqual([...ids].sort());
  });
  it('searches titles and chips, ignoring case and apostrophes', () => {
    expect(searchCards(CARDS, 'raynauds').map((c) => c.id)).toContain('S16');
    expect(searchCards(CARDS, 'RACING pulse').map((c) => c.id)).toEqual(['S04']);
    expect(searchCards(CARDS, 'shaky').map((c) => c.id)).toContain('S07');
    expect(searchCards(CARDS, '')).toHaveLength(34);
    expect(searchCards(CARDS, 'zzzz')).toEqual([]);
  });
  it('every chip belongs to a picker group and every card is reachable from the picker', () => {
    const reachable = new Set(chipChoices(CARDS).flatMap((g) => g.chips.flatMap((c) => c.cardIds)));
    expect(reachable.size).toBe(34);
  });
  it('maps built-in log chips to a guide', () => {
    expect(cardsForChips(['Dizzy']).map((c) => c.id)).toContain('S01');
    expect(cardsForChips(['Headache']).map((c) => c.id)).toContain('S28');
    expect(cardsForChips(['Something typed by hand'])).toEqual([]);
  });
});

describe('what feels worst', () => {
  const none = (input: Parameters<typeof decide>[0]) => run(input);
  it('opens the card when nothing else matched or readings were skipped', () => {
    expect(worstOutcome(none({}), 'Racing heart', ['S04'])).toEqual({ kind: 'card', cardId: 'S04' });
    expect(worstOutcome(none({ systolic: 120, diastolic: 80 }), 'Racing heart', ['S04'])).toEqual({ kind: 'card', cardId: 'S04' });
  });
  it('opens guide search when a chip fits several cards', () => {
    expect(worstOutcome(none({}), 'Blurry vision', ['S01', 'S25'])).toEqual({ kind: 'search', query: 'Blurry vision' });
  });
  it('never overrides a card from the readings, a recheck, or a very high reading', () => {
    expect(worstOutcome(run({ systolic: 85, diastolic: 55 }), 'Racing heart', ['S04'])).toBeNull();
    expect(worstOutcome(run({ systolic: 200, diastolic: 100 }), 'Racing heart', ['S04'])).toBeNull();
    expect(worstOutcome(run({ systolic: 200, diastolic: 100, alreadyRechecked: true }), 'Racing heart', ['S04'])).toBeNull();
    // Even if the very high card were missing, the chip must not replace the very high result.
    const noCard = decide({ systolic: 200, diastolic: 100, alreadyRechecked: true }, t, ROUTING, ['S01']);
    expect(noCard).toMatchObject({ kind: 'none', situation: 'very_high_bp' });
    expect(worstOutcome(noCard, 'Racing heart', ['S04'])).toBeNull();
  });
  it('does not act on implausible numbers or without a pick', () => {
    expect(worstOutcome(none({ systolic: 20, diastolic: 10 }), 'Racing heart', ['S04'])).toBeNull();
    expect(worstOutcome(none({}), null, [])).toBeNull();
    expect(worstOutcome(none({}), 'Unknown chip', [])).toBeNull();
  });
});
