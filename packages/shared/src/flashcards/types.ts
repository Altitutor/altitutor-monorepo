export type FlashcardCollection = {
  id: string;
  topic_id: string;
  title: string;
  description: string | null;
  index: number;
  flashcard_count?: number | null;
  review_card_count?: number | null;
  due_review_card_count?: number | null;
};

export type Flashcard = {
  id: string;
  collection_id: string;
  title: string | null;
  cloze_text: string;
  extra: string | null;
  index: number;
  review_card_count?: number | null;
};

export type FlashcardReviewCard = {
  id: string;
  flashcard_id: string;
  cloze_index: number;
  collection_id: string;
  title: string | null;
  cloze_text: string;
  extra: string | null;
  flashcard_index: number;
  due_at: string;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  lapses: number;
  last_reviewed_at: string | null;
  last_rating: FlashcardRating | null;
};

export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy';

export type FlashcardImportRow = {
  title: string | null;
  clozeText: string;
  extra: string | null;
  order: number | null;
};

export type FlashcardImportResult = {
  rows: FlashcardImportRow[];
  rejected: Array<{ row: number; reason: string }>;
};
