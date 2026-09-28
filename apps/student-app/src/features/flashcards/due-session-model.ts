import type { FlashcardReviewCard } from '@altitutor/shared';

export type AnsweredCardHold = { revision: number; dueAt: string };

export function availableDueSessionCards(
  cards: FlashcardReviewCard[],
  answered: ReadonlyMap<string, AnsweredCardHold>,
  now: Date,
  pendingCardId?: string | null,
): FlashcardReviewCard[] {
  return cards.filter((card) => {
    if (card.id === pendingCardId) return false;
    const hold = answered.get(card.id);
    if (!hold) return true;
    if (card.revision <= hold.revision) return false;
    return new Date(hold.dueAt).getTime() <= now.getTime();
  });
}

export function nextDueSessionCard(
  cards: FlashcardReviewCard[],
  answered: ReadonlyMap<string, AnsweredCardHold>,
  now: Date,
  pendingCardId?: string | null,
): FlashcardReviewCard | null {
  return availableDueSessionCards(cards, answered, now, pendingCardId)[0] ?? null;
}
