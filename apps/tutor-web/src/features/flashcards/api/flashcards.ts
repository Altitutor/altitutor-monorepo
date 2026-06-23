import type { Flashcard, FlashcardCollection } from '@altitutor/shared';

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

  async createCollection(input: { topicId: string; title: string; description?: string }): Promise<FlashcardCollection> {
    const res = await fetch('/api/flashcards/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_id: input.topicId, title: input.title, description: input.description }),
    });
    return readJson<FlashcardCollection>(res);
  },

  async deleteCollection(collectionId: string): Promise<void> {
    const res = await fetch(`/api/flashcards/collections/${encodeURIComponent(collectionId)}`, { method: 'DELETE' });
    await readJson<unknown>(res);
  },

  async updateCollection(input: { collectionId: string; title: string; description?: string }): Promise<FlashcardCollection> {
    const res = await fetch(`/api/flashcards/collections/${encodeURIComponent(input.collectionId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: input.title, description: input.description }),
    });
    return readJson<FlashcardCollection>(res);
  },

  async listCards(collectionId: string): Promise<Flashcard[]> {
    const res = await fetch(`/api/flashcards/collections/${encodeURIComponent(collectionId)}/cards`);
    return readJson<Flashcard[]>(res);
  },

  async createCard(input: {
    collectionId: string;
    title?: string;
    clozeText: string;
    extra?: string;
  }): Promise<Flashcard> {
    const res = await fetch(`/api/flashcards/collections/${encodeURIComponent(input.collectionId)}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        cloze_text: input.clozeText,
        extra: input.extra,
      }),
    });
    return readJson<Flashcard>(res);
  },

  async deleteCard(cardId: string): Promise<void> {
    const res = await fetch(`/api/flashcards/cards/${encodeURIComponent(cardId)}`, { method: 'DELETE' });
    await readJson<unknown>(res);
  },

  async updateCard(input: {
    cardId: string;
    title?: string;
    clozeText: string;
    extra?: string;
  }): Promise<Flashcard> {
    const res = await fetch(`/api/flashcards/cards/${encodeURIComponent(input.cardId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: input.title, cloze_text: input.clozeText, extra: input.extra }),
    });
    return readJson<Flashcard>(res);
  },

  async importCsv(collectionId: string, csv: string): Promise<{ inserted: number; rejected: Array<{ row: number; reason: string }> }> {
    const res = await fetch(`/api/flashcards/collections/${encodeURIComponent(collectionId)}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv }),
    });
    return readJson<{ inserted: number; rejected: Array<{ row: number; reason: string }> }>(res);
  },
};
