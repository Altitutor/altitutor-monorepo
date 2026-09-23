import type { FlashcardReviewCard, FlashcardStudySnapshot, FlashcardTopic, RateFlashcardCommand } from '@altitutor/shared';

async function readJson<T>(response: Response): Promise<T> {
  const json = await response.json();
  if (!response.ok) {
    const error = new Error(json.error ?? 'Flashcard request failed') as Error & { status: number };
    error.status = response.status;
    throw error;
  }
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

  async getDueReviewCount(): Promise<number> {
    const res = await fetch('/api/flashcards/review-cards?mode=due&countsOnly=1');
    const data = await readJson<{ total: number }>(res);
    return data.total;
  },

  async listDueReviewCards(topicIds?: string[]): Promise<FlashcardStudySnapshot> {
    const params = new URLSearchParams({ mode: 'due' });
    if (topicIds?.length) {
      params.set('topicIds', topicIds.join(','));
    }
    const res = await fetch(`/api/flashcards/review-cards?${params.toString()}`);
    return readJson<FlashcardStudySnapshot>(res);
  },

  async rateReviewCard(command: RateFlashcardCommand): Promise<FlashcardReviewCard> {
    const res = await fetch(`/api/flashcards/review-cards/${encodeURIComponent(command.reviewCardId)}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
    return readJson<FlashcardReviewCard>(res);
  },
};
