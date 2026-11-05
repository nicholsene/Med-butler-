import rawCards from '../data/cards.json';
import rawSources from '../data/sources.json';
import rawRouting from '../data/routing.json';
import rawChips from '../data/logChips.json';
import rawChipGuides from '../data/chipGuides.json';
import type { Card, SourceMap } from '../data/card.types';
import { validateCards } from './cardValidator';
import type { Routing } from './decide';

export const SOURCES = rawSources as SourceMap;
export const ROUTING = rawRouting as Routing;

const loaded = validateCards(rawCards, SOURCES);
/** Only cards that passed validation. A bad card is skipped and reported in Settings, never shown. */
export const CARDS: Card[] = loaded.valid;
export const CARD_ERRORS = loaded.errors;
export const CARD_IDS = CARDS.map((c) => c.id);

/** Returns undefined for any id the current cards.json doesn't have. */
export const getCard = (id: string): Card | undefined => CARDS.find((c) => c.id === id);

export function logChips(custom: string[]): string[] {
  return [...new Set([...(rawChips as string[]), ...CARDS.flatMap((c) => c.chips), ...custom])];
}

const CHIP_GUIDES = rawChipGuides as Record<string, string>;

/** Guides that match any of these chips: a card's own chips, plus the few built-in log chips mapped to a guide. */
export const cardsForChips = (chips: string[]) =>
  CARDS.filter((c) => c.chips.some((chip) => chips.includes(chip)) || chips.some((chip) => CHIP_GUIDES[chip] === c.id));

/** Every source a card cites, in first-use order. */
export function cardSourceIds(card: Card): string[] {
  const all = [...card.steps, ...card.avoid, ...card.callDoctor, ...card.emergency].flatMap((x) => x.sources);
  return [...new Set(all)];
}
