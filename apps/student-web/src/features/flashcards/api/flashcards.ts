import type { FlashcardRating, FlashcardReviewCard, FlashcardTopic } from '@altitutor/shared';

async function readJson<T>(response: Response): Promise<T> {
  const json = await response.json();
  if (!response.ok) throw new Error(json.error ?? 'Flashcard request failed');
  return json.data as T;
}

export const flashcardsApi = {
  async getTopic(topicId: string): Promise<FlashcardTopic | null> {
    const res = await fetch(`/api/flashcards?topicId=${encodeURIComponent(topicId)}`);
    return readJson<FlashcardTopic | null>(res);
  },

  async listReviewCards(topicId: string, mode: 'due' | 'all'): Promise<FlashcardReviewCard[]> {
    const res = await fetch(`/api/flashcards/review-cards?topicId=${encodeURIComponent(topicId)}&mode=${mode}`);
    return readJson<FlashcardReviewCard[]>(res);
  },

  async listDueReviewCards(topicIds?: string[]): Promise<FlashcardReviewCard[]> {
    const params = new URLSearchParams({ mode: 'due' });
    if (topicIds?.length) {
      params.set('topicIds', topicIds.join(','));
    }
    const res = await fetch(`/api/flashcards/review-cards?${params.toString()}`);
    return readJson<FlashcardReviewCard[]>(res);
  },

  async rateReviewCard(reviewCardId: string, rating: FlashcardRating): Promise<FlashcardReviewCard> {
    const res = await fetch(`/api/flashcards/review-cards/${encodeURIComponent(reviewCardId)}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating }),
    });
    return readJson<FlashcardReviewCard>(res);
  },
};
