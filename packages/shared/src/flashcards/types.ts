export type FlashcardTopic = {
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
  topic_id: string;
  cloze_text: string;
  extra: string | null;
  index: number;
  review_card_count?: number | null;
};

export type FlashcardReviewCard = {
  id: string;
  flashcard_id: string;
  cloze_index: number;
  topic_id: string;
  cloze_text: string;
  extra: string | null;
  flashcard_index: number;
  due_at: string;
  stability: number | null;
  difficulty: number | null;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: 'New' | 'Learning' | 'Review' | 'Relearning';
  last_reviewed_at: string | null;
  last_rating: FlashcardRating | null;
};

export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy';

export type FlashcardImportRow = {
  clozeText: string;
  extra: string | null;
  order: number | null;
};

export type FlashcardImportResult = {
  rows: FlashcardImportRow[];
  rejected: Array<{ row: number; reason: string }>;
};
