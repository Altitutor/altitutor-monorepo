import type { FlashcardReviewCard } from '@altitutor/shared';

import { plainFlashcardPreview } from './flashcard-html';

export type FlashcardGroup = {
  id: string;
  cards: FlashcardReviewCard[];
  preview: string;
  dueAt: string;
};

export type FlashcardManageFilters = {
  search: string;
  state: FlashcardReviewCard['state'] | 'all';
  flag: 'all' | 'suspended' | 'buried' | 'leech';
  sort: 'order' | 'due' | 'state';
};

const stateOrder: Record<FlashcardReviewCard['state'], number> = {
  New: 0, Learning: 1, Relearning: 2, Review: 3,
};

export function groupFlashcards(cards: FlashcardReviewCard[]): FlashcardGroup[] {
  const byFlashcard = new Map<string, FlashcardReviewCard[]>();
  for (const card of cards) {
    const group = byFlashcard.get(card.flashcard_id) ?? [];
    group.push(card);
    byFlashcard.set(card.flashcard_id, group);
  }
  return [...byFlashcard.entries()].map(([id, group]) => {
    const sorted = [...group].sort((a, b) => a.cloze_index - b.cloze_index);
    return {
      id,
      cards: sorted,
      preview: plainFlashcardPreview(sorted[0].cloze_text ?? sorted[0].image_alt_text ?? `Flashcard ${sorted[0].flashcard_index + 1}`),
      dueAt: sorted.reduce((earliest, card) => card.due_at < earliest ? card.due_at : earliest, sorted[0].due_at),
    };
  });
}

export function filterFlashcardGroups(groups: FlashcardGroup[], filters: FlashcardManageFilters): FlashcardGroup[] {
  const search = filters.search.trim().toLowerCase();
  return groups.filter((group) => {
    const searchable = [group.preview, ...group.cards.flatMap((card) => [card.topic_code ?? '', card.topic_name ?? '', card.subject_short_name ?? ''])].join(' ').toLowerCase();
    if (search && !searchable.includes(search)) return false;
    if (filters.state !== 'all' && !group.cards.some((card) => card.state === filters.state)) return false;
    if (filters.flag !== 'all' && !group.cards.some((card) =>
      filters.flag === 'buried' ? Boolean(card.buried_until)
        : filters.flag === 'suspended' ? Boolean(card.suspended_at)
          : Boolean(card.leech_at))) return false;
    return true;
  }).sort((a, b) => {
    if (filters.sort === 'due') return a.dueAt.localeCompare(b.dueAt);
    if (filters.sort === 'state') return stateOrder[a.cards[0].state] - stateOrder[b.cards[0].state];
    return a.cards[0].flashcard_index - b.cards[0].flashcard_index;
  });
}
