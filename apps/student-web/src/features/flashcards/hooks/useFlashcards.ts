import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FlashcardRating } from '@altitutor/shared';
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
  const topicIdsKey = topicIds?.join(',') ?? 'all';
  return useQuery({
    queryKey: ['flashcards', 'review-cards', 'due-all', topicIdsKey],
    queryFn: () => flashcardsApi.listDueReviewCards(topicIds ?? undefined),
  });
}

export function useRateFlashcardReviewCard(topicId: string, mode: 'due' | 'all') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewCardId, rating }: { reviewCardId: string; rating: FlashcardRating }) =>
      flashcardsApi.rateReviewCard(reviewCardId, rating),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['flashcards', 'review-cards', topicId, mode] });
      await queryClient.invalidateQueries({ queryKey: ['flashcards', 'review-cards', 'due-all'] });
      await queryClient.invalidateQueries({ queryKey: ['flashcards', 'topic', topicId] });
    },
  });
}
