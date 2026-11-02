import type { FlashcardReviewCard } from '@altitutor/shared';

export type FlashcardManagementAction = 'forget' | 'suspend' | 'resume' | 'bury' | 'unbury';

export type FlashcardHistoryEntry = {
  id: string;
  review_card_id: string;
  action: string;
  rating: string | null;
  answered_at: string;
  duration_ms: number | null;
  pre_state: Record<string, unknown>;
  post_state: Record<string, unknown>;
  undone_at: string | null;
};

export type FlashcardManagementResult = {
  cardState: Pick<FlashcardReviewCard,
    | 'id' | 'due_at' | 'stability' | 'difficulty' | 'scheduled_days'
    | 'learning_steps' | 'reps' | 'lapses' | 'state' | 'last_reviewed_at'
    | 'last_rating' | 'revision' | 'buried_until' | 'buried_reason'
    | 'suspended_at' | 'leech_at'
  >;
  historyEntry: FlashcardHistoryEntry;
};
