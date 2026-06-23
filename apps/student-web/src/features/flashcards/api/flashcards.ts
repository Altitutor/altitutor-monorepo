import type { FlashcardCollection, FlashcardRating, FlashcardReviewCard } from '@altitutor/shared';

async function readJson<T>(response: Response): Promise<T> {
  const json = await response.json();
  if (!response.ok) throw new Error(json.error ?? 'Flashcard request failed');
  return json.data as T;
}

export const flashcardsApi = {
  async listCollections(topicId: string): Promise<FlashcardCollection[]> {
    const res = await fetch(`/api/flashcards/collections?topicId=${encodeURIComponent(topicId)}`);
    return readJson<FlashcardCollection[]>(res);
  },

  async listReviewCards(collectionId: string, mode: 'due' | 'all'): Promise<FlashcardReviewCard[]> {
    const res = await fetch(
      `/api/flashcards/collections/${encodeURIComponent(collectionId)}/review-cards?mode=${mode}`,
    );
    return readJson<FlashcardReviewCard[]>(res);
  },

  async rateReviewCard(reviewCardId: string, rating: FlashcardRating): Promise<void> {
    const res = await fetch(`/api/flashcards/review-cards/${encodeURIComponent(reviewCardId)}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating }),
    });
    await readJson<unknown>(res);
  },
};
