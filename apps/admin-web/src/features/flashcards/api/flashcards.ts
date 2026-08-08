import type { Flashcard, FlashcardWriteInput, ImageOcclusionUpload } from '@altitutor/shared';

export type FlashcardMutationInput = FlashcardWriteInput & {
  topicId: string;
  extra?: string;
  index?: number;
};

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

  async createCard(input: FlashcardMutationInput): Promise<Flashcard> {
    const res = await fetch('/api/flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic_id: input.topicId,
        card_type: input.cardType,
        cloze_text: input.cardType === 'text_cloze' ? input.clozeText : null,
        extra: input.extra,
        index: input.index,
        image_file_id: input.cardType === 'image_occlusion' ? input.imageFileId : null,
        image_alt_text: input.cardType === 'image_occlusion' ? input.imageAltText : null,
        occlusion_data: input.cardType === 'image_occlusion' ? input.occlusionData : null,
      }),
    });
    return readJson<Flashcard>(res);
  },

  async deleteCard(cardId: string): Promise<void> {
    const res = await fetch(`/api/flashcards/cards/${encodeURIComponent(cardId)}`, { method: 'DELETE' });
    await readJson<unknown>(res);
  },

  async updateCard(input: FlashcardMutationInput & {
    cardId: string;
  }): Promise<Flashcard> {
    const res = await fetch(`/api/flashcards/cards/${encodeURIComponent(input.cardId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card_type: input.cardType,
        cloze_text: input.cardType === 'text_cloze' ? input.clozeText : null,
        extra: input.extra,
        index: input.index,
        topic_id: input.topicId,
        image_file_id: input.cardType === 'image_occlusion' ? input.imageFileId : null,
        image_alt_text: input.cardType === 'image_occlusion' ? input.imageAltText : null,
        occlusion_data: input.cardType === 'image_occlusion' ? input.occlusionData : null,
      }),
    });
    return readJson<Flashcard>(res);
  },

  async uploadImage(topicId: string, file: File): Promise<ImageOcclusionUpload> {
    const formData = new FormData();
    formData.set('topicId', topicId);
    formData.set('file', file);
    const res = await fetch('/api/flashcards/images/upload', { method: 'POST', body: formData });
    return readJson<ImageOcclusionUpload>(res);
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
