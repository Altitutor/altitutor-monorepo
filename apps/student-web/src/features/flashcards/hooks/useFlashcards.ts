import { useMutation, useQuery } from '@tanstack/react-query';
import type { RateFlashcardCommand } from '@altitutor/shared';
import { flashcardsApi } from '../api/flashcards';

export function useFlashcardTopic(topicId: string | null) {
  return useQuery({
    queryKey: ['flashcards', 'topic', topicId],
    queryFn: () => {
      if (!topicId) throw new Error('Topic ID is required');
      return flashcardsApi.getTopic(topicId);
    },
    enabled: Boolean(topicId),
  });
}

export function useFlashcardReviewCards(topicId: string | null, mode: 'due' | 'all') {
  return useQuery({
    queryKey: ['flashcards', 'review-cards', topicId, mode],
    queryFn: () => {
      if (!topicId) throw new Error('Topic ID is required');
      return flashcardsApi.listReviewCards(topicId, mode);
    },
    enabled: Boolean(topicId),
  });
}

export function useDueFlashcardReviewCards(topicIds?: string[] | null) {
  const topicIdsKey = topicIds === undefined ? 'all' : topicIds === null ? 'idle' : topicIds.join(',');
  return useQuery({
    queryKey: ['flashcards', 'review-cards', 'due-all', topicIdsKey],
    queryFn: () => flashcardsApi.listDueReviewCards(topicIds && topicIds.length > 0 ? topicIds : undefined),
    enabled: topicIds === undefined || (topicIds !== null && topicIds.length > 0),
    refetchOnWindowFocus: false,
  });
}

export function useRateFlashcardReviewCard(_topicId: string, _mode: 'due' | 'all') {
  return useMutation({
    mutationFn: (command: RateFlashcardCommand) => flashcardsApi.rateReviewCard(command),
  });
}
