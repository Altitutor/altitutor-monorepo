import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FlashcardRating } from '@altitutor/shared';
import { flashcardsApi } from '../api/flashcards';

export function useFlashcardCollections(topicId: string | null) {
  return useQuery({
    queryKey: ['flashcards', 'collections', topicId],
    queryFn: () => {
      if (!topicId) throw new Error('Topic ID is required');
      return flashcardsApi.listCollections(topicId);
    },
    enabled: Boolean(topicId),
  });
}

export function useFlashcardReviewCards(collectionId: string | null, mode: 'due' | 'all') {
  return useQuery({
    queryKey: ['flashcards', 'review-cards', collectionId, mode],
    queryFn: () => {
      if (!collectionId) throw new Error('Collection ID is required');
      return flashcardsApi.listReviewCards(collectionId, mode);
    },
    enabled: Boolean(collectionId),
  });
}

export function useRateFlashcardReviewCard(collectionId: string, mode: 'due' | 'all') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewCardId, rating }: { reviewCardId: string; rating: FlashcardRating }) =>
      flashcardsApi.rateReviewCard(reviewCardId, rating),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['flashcards', 'review-cards', collectionId, mode] });
      await queryClient.invalidateQueries({ queryKey: ['flashcards', 'collections'] });
    },
  });
}
