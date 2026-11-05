import type { Card, CardStep } from '../data/card.types';

export type RatingValue = 'helped' | 'didnt_help' | 'made_worse' | 'not_now';

export type StepRating = {
  id: string;
  cardId: string;
  stepId: string;
  rating: RatingValue;
  at: number;
  /** Snapshot, so the Visit Brief still reads correctly if the card is later replaced. */
  stepText: string;
  cardTitle: string;
  safety: boolean;
};

export const RATING_LABEL: Record<RatingValue, string> = {
  helped: 'Helped',
  didnt_help: "Didn't help",
  made_worse: 'Made it worse',
  not_now: 'Not now',
};

const RANK: Record<RatingValue | 'unrated', number> = { helped: 0, unrated: 1, not_now: 2, didnt_help: 3, made_worse: 4 };

/** The most recent rating per step. A later rating replaces an earlier one. */
export function latestByStep(ratings: StepRating[], cardId?: string): Map<string, StepRating> {
  const out = new Map<string, StepRating>();
  for (const r of ratings) {
    if (cardId !== undefined && r.cardId !== cardId) continue;
    const key = cardId !== undefined ? r.stepId : `${r.cardId}|${r.stepId}`;
    const prev = out.get(key);
    if (!prev || r.at >= prev.at) out.set(key, r);
  }
  return out;
}

/**
 * Safety steps stay at their original position and can never be hidden, whatever their rating.
 * Other steps fill the remaining slots: helped, unrated, not now, didn't help. Ties keep card order.
 * "Made it worse" hides a non-safety step for this card only.
 */
export function applyRatings(card: Pick<Card, 'id' | 'steps'>, ratings: StepRating[]): { visible: CardStep[]; hidden: CardStep[] } {
  const latest = latestByStep(ratings, card.id);
  const rank = (s: CardStep) => RANK[latest.get(s.id)?.rating ?? 'unrated'];
  const hidden = card.steps.filter((s) => !s.safety && latest.get(s.id)?.rating === 'made_worse');
  const movable = card.steps
    .filter((s) => !s.safety && !hidden.includes(s))
    .map((step, order) => ({ step, order }))
    .sort((a, b) => rank(a.step) - rank(b.step) || a.order - b.order)
    .map((x) => x.step);

  const visible = card.steps
    .map((s) => (s.safety ? s : (movable.shift() ?? null)))
    .filter((s): s is CardStep => s !== null);
  return { visible, hidden };
}
