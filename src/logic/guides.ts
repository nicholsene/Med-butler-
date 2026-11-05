import groups from '../data/groups.json';
import type { Card, CardGroup } from '../data/card.types';
import type { Decision } from './decide';

export const GROUPS = groups as CardGroup[];

export const groupName = (id: string) => GROUPS.find((g) => g.id === id)?.name ?? 'Other guides';

export type GuideGroup = { id: string; name: string; cards: Card[] };

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim();

/** Cards whose title or any chip contains every word typed. An empty query keeps every card. */
export function searchCards(cards: Card[], query: string): Card[] {
  const words = norm(query).split(' ').filter(Boolean);
  if (!words.length) return cards;
  return cards.filter((c) => {
    const hay = norm([c.title, ...c.chips].join(' | '));
    return words.every((w) => hay.includes(w));
  });
}

/** Cards grouped by card.group in the order of groups.json. A group no one named still appears, last, so no card is lost. */
export function groupCards(cards: Card[]): GuideGroup[] {
  const known = new Set(GROUPS.map((g) => g.id));
  const out: GuideGroup[] = GROUPS.map((g) => ({ ...g, cards: cards.filter((c) => c.group === g.id) }));
  const rest = cards.filter((c) => !known.has(c.group));
  if (rest.length) out.push({ id: 'unlisted', name: 'Other guides', cards: rest });
  return out.filter((g) => g.cards.length > 0);
}

/** Every distinct chip across the cards, with the cards that use it, grouped for the "What feels worst?" picker. */
export function chipChoices(cards: Card[]): { id: string; name: string; chips: { chip: string; cardIds: string[] }[] }[] {
  return groupCards(cards).map((g) => {
    const map = new Map<string, string[]>();
    for (const c of g.cards) for (const chip of c.chips) map.set(chip, [...(map.get(chip) ?? []), c.id]);
    return { id: g.id, name: g.name, chips: [...map].map(([chip, cardIds]) => ({ chip, cardIds })) };
  });
}

export type WorstOutcome = { kind: 'card'; cardId: string } | { kind: 'search'; query: string } | null;

/**
 * Where "What feels worst?" may send someone. It only acts when the readings and answers found nothing:
 * never after a very high reading, a recheck, a card from the readings, or numbers that look wrong.
 * `chipCards` are the cards matching the picked chip. A chip on several cards opens the guide search instead of guessing.
 */
export function worstOutcome(decision: Decision, chip: string | null, chipCards: string[]): WorstOutcome {
  if (!chip) return null;
  if (decision.kind !== 'none') return null;
  if (decision.reason === 'implausible' || decision.reason === 'no_card') return null;
  if (decision.situation === 'very_high_bp') return null;
  if (chipCards.length === 1) return { kind: 'card', cardId: chipCards[0] };
  if (chipCards.length > 1) return { kind: 'search', query: chip };
  return null;
}
