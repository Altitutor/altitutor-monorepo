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
  card_type: FlashcardType;
  cloze_text: string | null;
  extra: string | null;
  image_file_id: string | null;
  image_alt_text: string | null;
  image_storage_path?: string | null;
  image_mimetype?: string | null;
  image_url?: string | null;
  occlusion_data: ImageOcclusionData | null;
  index: number;
  review_card_count?: number | null;
};

export type FlashcardReviewCard = {
  id: string;
  flashcard_id: string;
  cloze_index: number;
  topic_id: string;
  card_type: FlashcardType;
  cloze_text: string | null;
  extra: string | null;
  image_file_id: string | null;
  image_alt_text: string | null;
  image_storage_path: string | null;
  image_mimetype: string | null;
  image_url?: string | null;
  occlusion_data: ImageOcclusionData | null;
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
  rating_previews?: Record<FlashcardRating, FlashcardRatingPreview>;
};

export type FlashcardType = 'text_cloze' | 'image_occlusion';

export type ImageOcclusionMask = {
  id: string;
  clozeIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImageOcclusionData = {
  version: 1;
  naturalWidth: number;
  naturalHeight: number;
  masks: ImageOcclusionMask[];
  groupDescriptions?: Record<string, string>;
};

export type ImageOcclusionUpload = {
  fileId: string;
  storagePath: string;
  signedUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  mimetype: string;
};

export type FlashcardWriteInput =
  | {
      cardType: 'text_cloze';
      clozeText: string;
      imageFileId?: never;
      imageAltText?: never;
      occlusionData?: never;
    }
  | {
      cardType: 'image_occlusion';
      clozeText?: never;
      imageFileId: string;
      imageAltText?: string;
      occlusionData: ImageOcclusionData;
    };

export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy';

export type FlashcardRatingPreview = {
  due_at: string;
  label: string;
};

export type FlashcardImportRow = {
  clozeText: string;
  extra: string | null;
  order: number | null;
};

export type FlashcardImportResult = {
  rows: FlashcardImportRow[];
  rejected: Array<{ row: number; reason: string }>;
};
