import type { Card } from '../data/card.types';
import type { PrepItemState } from '../repo/types';

export const LOCATIONS = ['Bedside', 'Bag', 'Car or stroller'] as const;
export type Location = (typeof LOCATIONS)[number];

export const prepId = (cardId: string, location: string, item: string) => `${cardId}|${location}|${item}`;

export function parsePrepId(id: string) {
  const [cardId, location, ...rest] = id.split('|');
  return { id, cardId, location, item: rest.join('|') };
}

export type KitRow = { id: string; cardId: string; location: string; item: string; have: boolean; custom: boolean };

export function kitRows(card: Card, location: string, state: PrepItemState[]): KitRow[] {
  const here = state.filter((s) => s.cardId === card.id && s.location === location);
  const rows: KitRow[] = card.prepItems.map((item) => {
    const id = prepId(card.id, location, item);
    return { id, cardId: card.id, location, item, custom: false, have: here.find((s) => s.id === id)?.have ?? false };
  });
  for (const s of here) if (s.custom) rows.push({ id: s.id, cardId: s.cardId, location, item: s.item, have: s.have, custom: true });
  return rows;
}

/** A location counts once something there has been ticked or unticked, so a new kit isn't all "missing". */
export const isStarted = (cardId: string, location: string, state: PrepItemState[]) =>
  state.some((s) => s.cardId === cardId && s.location === location);

export function missingItems(cards: Card[], state: PrepItemState[]): KitRow[] {
  return cards.flatMap((card) =>
    LOCATIONS.flatMap((location) =>
      isStarted(card.id, location, state) ? kitRows(card, location, state).filter((r) => !r.have) : [],
    ),
  );
}

export function kitSummary(card: Card, state: PrepItemState[]): { text: string; status: 'Ready' | 'Fix' | 'Check' } {
  const parts: string[] = [];
  let started = 0;
  let missing = 0;
  for (const location of LOCATIONS) {
    if (!isStarted(card.id, location, state)) continue;
    started++;
    const n = kitRows(card, location, state).filter((r) => !r.have).length;
    missing += n;
    parts.push(n ? `${location} needs ${n} ${n === 1 ? 'item' : 'items'}` : `${location} ready`);
  }
  if (!started) return { text: 'Not checked yet', status: 'Check' };
  return { text: parts.join('. '), status: missing ? 'Fix' : started === LOCATIONS.length ? 'Ready' : 'Check' };
}

export function restockHeadline(missing: KitRow[]): { title: string; detail: string } | null {
  if (!missing.length) return null;
  const first = missing[0];
  const where = first.location === 'Bag' ? 'your bag' : first.location === 'Bedside' ? 'your bedside' : 'your car or stroller';
  return {
    title: missing.length === 1 ? 'One thing to restock' : `${missing.length} things to restock`,
    detail: `${first.item} is missing from ${where}`,
  };
}
