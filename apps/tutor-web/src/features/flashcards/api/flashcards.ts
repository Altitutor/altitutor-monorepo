import type { Flashcard } from '@altitutor/shared';

async function readJson<T>(response: Response): Promise<T> {
  const json = await response.json();
  if (!response.ok) throw new Error(json.error ?? 'Flashcard request failed');
  return json.data as T;
}

export const flashcardsApi = {
  async listCards(topicId: string): Promise<Flashcard[]> {
    const res = await fetch(`/api/flashcards?topicId=${encodeURIComponent(topicId)}`);
    return readJson<Flashcard[]>(res);
  },

  async createCard(input: { topicId: string; clozeText: string; extra?: string; index?: number }): Promise<Flashcard> {
    const res = await fetch('/api/flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic_id: input.topicId,
        cloze_text: input.clozeText,
        extra: input.extra,
        index: input.index,
      }),
    });
    return readJson<Flashcard>(res);
  },

  async deleteCard(cardId: string): Promise<void> {
    const res = await fetch(`/api/flashcards/cards/${encodeURIComponent(cardId)}`, { method: 'DELETE' });
    await readJson<unknown>(res);
  },

  async updateCard(input: { cardId: string; topicId?: string; clozeText: string; extra?: string; index?: number }): Promise<Flashcard> {
    const res = await fetch(`/api/flashcards/cards/${encodeURIComponent(input.cardId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic_id: input.topicId,
        cloze_text: input.clozeText,
        extra: input.extra,
        index: input.index,
      }),
    });
    return readJson<Flashcard>(res);
  },

  async reorderCards(topicId: string, cardIds: string[]): Promise<{ updated: number }> {
    const res = await fetch('/api/flashcards/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_id: topicId, card_ids: cardIds }),
    });
    return readJson<{ updated: number }>(res);
  },

  async importCsv(topicId: string, csv: string): Promise<{ inserted: number; rejected: Array<{ row: number; reason: string }> }> {
    const res = await fetch('/api/flashcards/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_id: topicId, csv }),
    });
    return readJson<{ inserted: number; rejected: Array<{ row: number; reason: string }> }>(res);
  },
};
