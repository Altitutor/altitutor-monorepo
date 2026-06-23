import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { flashcardsApi } from '../api/flashcards';

export function useFlashcards(topicId: string | null) {
  return useQuery({
    queryKey: ['flashcards', 'cards', topicId],
    queryFn: () => {
      if (!topicId) throw new Error('Topic ID is required');
      return flashcardsApi.listCards(topicId);
    },
    enabled: Boolean(topicId),
  });
}

export function useFlashcardMutations(topicId: string | null) {
  const queryClient = useQueryClient();
  const invalidateCards = () => queryClient.invalidateQueries({ queryKey: ['flashcards', 'cards', topicId] });

  return {
    createCard: useMutation({ mutationFn: flashcardsApi.createCard, onSuccess: invalidateCards }),
    deleteCard: useMutation({ mutationFn: flashcardsApi.deleteCard, onSuccess: invalidateCards }),
    updateCard: useMutation({ mutationFn: flashcardsApi.updateCard, onSuccess: invalidateCards }),
    importCsv: useMutation({
      mutationFn: ({ id, csv }: { id: string; csv: string }) => flashcardsApi.importCsv(id, csv),
      onSuccess: invalidateCards,
    }),
  };
}
