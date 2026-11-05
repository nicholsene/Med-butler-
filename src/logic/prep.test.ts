import { describe, expect, it } from 'vitest';
import { isStarted, kitRows, kitSummary, missingItems, prepId, restockHeadline } from './prep';
import type { Card } from '../data/card.types';
import type { PrepItemState } from '../repo/types';

const card = { id: 'c', prepItems: ['A', 'B'] } as Card;
const st = (location: string, item: string, have: boolean, custom = false): PrepItemState => ({
  id: prepId('c', location, item),
  cardId: 'c',
  location,
  item,
  have,
  custom,
});

describe('prep', () => {
  it('a new kit is not reported as missing', () => {
    expect(isStarted('c', 'Bag', [])).toBe(false);
    expect(missingItems([card], [])).toEqual([]);
    expect(kitSummary(card, []).status).toBe('Check');
    expect(restockHeadline([])).toBeNull();
  });
  it('once started, unticked items are missing', () => {
    const state = [st('Bag', 'A', true)];
    expect(missingItems([card], state).map((r) => r.item)).toEqual(['B']);
    expect(kitSummary(card, state)).toEqual({ text: 'Bag needs 1 item', status: 'Fix' });
    expect(restockHeadline(missingItems([card], state))).toEqual({ title: 'One thing to restock', detail: 'B is missing from your bag' });
  });
  it('includes custom items', () => {
    expect(kitRows(card, 'Bag', [st('Bag', 'Mine', false, true)]).map((r) => r.item)).toEqual(['A', 'B', 'Mine']);
  });
  it('state for a card that no longer exists is ignored', () => {
    const orphan = { ...st('Bag', 'Z', false), cardId: 'gone' };
    expect(missingItems([card], [orphan])).toEqual([]);
  });
});
