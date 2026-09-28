import type {
  FlashcardReviewCard,
  FlashcardStudySnapshot,
  FlashcardTopic,
  RateFlashcardCommand,
} from '@altitutor/shared';

import { studentWebUrl } from '@/lib/student-web';
import { supabase } from '@/lib/supabase';

export type FlashcardManageAction = 'forget' | 'suspend' | 'resume' | 'bury' | 'unbury';

export class FlashcardApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string | null = null) {
    super(message);
    this.name = 'FlashcardApiError';
  }
}

async function flashcardRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new FlashcardApiError('Please sign in to study flashcards.', 401);

  const response = await fetch(studentWebUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session.access_token}`,
      ...init?.headers,
    },
    credentials: 'omit',
    cache: 'no-store',
    signal: init?.signal ?? AbortSignal.timeout(30000),
  });
  const body: unknown = await response.json().catch(() => null);
  const result = body && typeof body === 'object' ? body as { data?: T; error?: string; code?: string } : null;
  if (!response.ok) {
    throw new FlashcardApiError(result?.error ?? 'Flashcard request failed.', response.status, result?.code ?? null);
  }
  return result?.data as T;
}

export const flashcardApi = {
  topic(topicId: string) {
    return flashcardRequest<FlashcardTopic | null>(`/api/flashcards?topicId=${encodeURIComponent(topicId)}`);
  },
  dueCount() {
    return flashcardRequest<{ total: number }>('/api/flashcards/review-cards?mode=due&countsOnly=1');
  },
  dueSnapshot(topicIds?: string[]) {
    const search = new URLSearchParams({ mode: 'due' });
    if (topicIds?.length) search.set('topicIds', topicIds.join(','));
    return flashcardRequest<FlashcardStudySnapshot>(`/api/flashcards/review-cards?${search.toString()}`);
  },
  topicCards(topicId: string) {
    return flashcardRequest<FlashcardReviewCard[]>(`/api/flashcards/review-cards?topicId=${encodeURIComponent(topicId)}&mode=all`);
  },
  allCards() {
    return flashcardRequest<FlashcardReviewCard[]>('/api/flashcards/review-cards?mode=all');
  },
  rate(command: RateFlashcardCommand) {
    return flashcardRequest<FlashcardReviewCard>(
      `/api/flashcards/review-cards/${encodeURIComponent(command.reviewCardId)}/rate`,
      { method: 'POST', body: JSON.stringify(command) },
    );
  },
  undo(answerLogId: string, requestId: string) {
    return flashcardRequest<unknown>('/api/flashcards/review-cards/undo', {
      method: 'POST', body: JSON.stringify({ answerLogId, requestId }),
    });
  },
  manage(reviewCardId: string, action: FlashcardManageAction, requestId: string) {
    return flashcardRequest<unknown>(`/api/flashcards/review-cards/${encodeURIComponent(reviewCardId)}/manage`, {
      method: 'POST', body: JSON.stringify({ action, requestId }),
    });
  },
  signedImageUrls(paths: string[]) {
    return flashcardRequest<{ signedUrls: string[] }>('/api/flashcards/images/signed-urls', {
      method: 'POST', body: JSON.stringify({ paths }),
    });
  },
};
