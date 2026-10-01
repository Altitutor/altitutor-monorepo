import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RateFlashcardCommand } from '@altitutor/shared';

import { useAuth } from '@/providers/auth-provider';

import { flashcardApi, type FlashcardManageAction } from './flashcard-api';

export const flashcardKeys = {
  all: ['flashcards'] as const,
  dueCount: ['flashcards', 'due-count'] as const,
  snapshot: (topicIds?: string[]) => ['flashcards', 'snapshot', topicIds?.join(',') ?? 'all'] as const,
  topic: (topicId: string) => ['flashcards', 'topic', topicId] as const,
  topicCards: (topicId: string) => ['flashcards', 'topic-cards', topicId] as const,
  manage: ['flashcards', 'manage'] as const,
};

export function useDueFlashcardCount() {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...flashcardKeys.dueCount, session?.user.id],
    queryFn: async () => (await flashcardApi.dueCount()).total,
    enabled: Boolean(session),
    staleTime: 30_000,
  });
}

export function useFlashcardSnapshot(topicIds?: string[]) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...flashcardKeys.snapshot(topicIds), session?.user.id],
    queryFn: () => flashcardApi.dueSnapshot(topicIds),
    enabled: Boolean(session) && (topicIds === undefined || topicIds.length > 0),
    refetchOnMount: 'always',
  });
}

export function useFlashcardTopic(topicId: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...flashcardKeys.topic(topicId), session?.user.id],
    queryFn: () => flashcardApi.topic(topicId),
    enabled: Boolean(session) && Boolean(topicId),
  });
}

export function useTopicFlashcardCards(topicId: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...flashcardKeys.topicCards(topicId), session?.user.id],
    queryFn: () => flashcardApi.topicCards(topicId),
    enabled: Boolean(session) && Boolean(topicId),
    refetchOnMount: 'always',
  });
}

export function useManageFlashcards() {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...flashcardKeys.manage, session?.user.id],
    queryFn: flashcardApi.allCards,
    enabled: Boolean(session),
    refetchOnMount: 'always',
  });
}

export function useRateFlashcard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: RateFlashcardCommand) => flashcardApi.rate(command),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: flashcardKeys.dueCount });
      void queryClient.invalidateQueries({ queryKey: flashcardKeys.manage });
    },
  });
}

export function useManageFlashcardAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewCardId, action, requestId }: { reviewCardId: string; action: FlashcardManageAction; requestId: string }) =>
      flashcardApi.manage(reviewCardId, action, requestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: flashcardKeys.all });
    },
  });
}
