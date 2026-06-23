import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export function useFlashcards(collectionId: string | null) {
  return useQuery({
    queryKey: ['flashcards', 'cards', collectionId],
    queryFn: () => {
      if (!collectionId) throw new Error('Collection ID is required');
      return flashcardsApi.listCards(collectionId);
    },
    enabled: Boolean(collectionId),
  });
}

export function useFlashcardMutations(topicId: string | null, collectionId: string | null) {
  const queryClient = useQueryClient();
  const invalidateCollections = () => queryClient.invalidateQueries({ queryKey: ['flashcards', 'collections', topicId] });
  const invalidateCards = () => queryClient.invalidateQueries({ queryKey: ['flashcards', 'cards', collectionId] });

  return {
    createCollection: useMutation({
      mutationFn: flashcardsApi.createCollection,
      onSuccess: invalidateCollections,
    }),
    deleteCollection: useMutation({
      mutationFn: flashcardsApi.deleteCollection,
      onSuccess: invalidateCollections,
    }),
    updateCollection: useMutation({
      mutationFn: flashcardsApi.updateCollection,
      onSuccess: invalidateCollections,
    }),
    createCard: useMutation({
      mutationFn: flashcardsApi.createCard,
      onSuccess: async () => {
        await invalidateCollections();
        await invalidateCards();
      },
    }),
    deleteCard: useMutation({
      mutationFn: flashcardsApi.deleteCard,
      onSuccess: async () => {
        await invalidateCollections();
        await invalidateCards();
      },
    }),
    updateCard: useMutation({
      mutationFn: flashcardsApi.updateCard,
      onSuccess: async () => {
        await invalidateCollections();
        await invalidateCards();
      },
    }),
    importCsv: useMutation({
      mutationFn: ({ id, csv }: { id: string; csv: string }) => flashcardsApi.importCsv(id, csv),
      onSuccess: async () => {
        await invalidateCollections();
        await invalidateCards();
      },
    }),
  };
}
