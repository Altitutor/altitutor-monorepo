import { useEffect, useState } from 'react';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export const dueFlashcardCountQueryKey = ['flashcards', 'due-count'] as const;

export function useDueFlashcardCount() {
  return useQuery({
    queryKey: dueFlashcardCountQueryKey,
    queryFn: () => flashcardsApi.getDueReviewCount(),
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

const flashcardAnswerMutationKey = ['flashcards', 'answer'] as const;

export function useDueFlashcardReviewCards(topicIds?: string[] | null) {
  const queryClient = useQueryClient();
  const topicIdsKey = topicIds === undefined ? 'all' : topicIds === null ? 'idle' : topicIds.join(',');
  const enabled = topicIds === undefined || (topicIds !== null && topicIds.length > 0);
  const [startedTopicIdsKey, setStartedTopicIdsKey] = useState<string | null>(null);
  // Wait for earlier answers at entry without interrupting an already-running session.
  const startingSession = enabled && startedTopicIdsKey !== topicIdsKey;
  const pendingAnswers = useIsMutating({ mutationKey: flashcardAnswerMutationKey });
  const query = useQuery({
    queryKey: ['flashcards', 'review-cards', 'due-all', topicIdsKey],
    queryFn: () => flashcardsApi.listDueReviewCards(topicIds && topicIds.length > 0 ? topicIds : undefined),
    enabled: enabled && (!startingSession || pendingAnswers === 0),
    // A cached snapshot can contain revisions already answered in another session.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (!enabled) setStartedTopicIdsKey(null);
    else if (startingSession && pendingAnswers === 0 && query.isSuccess && !query.isFetching) {
      setStartedTopicIdsKey(topicIdsKey);
    }
  }, [enabled, pendingAnswers, query.isFetching, query.isSuccess, startingSession, topicIdsKey]);
  useEffect(() => {
    if (topicIds === undefined && query.data) {
      queryClient.setQueryData(dueFlashcardCountQueryKey, query.data.counts.total);
    }
  }, [query.data, queryClient, topicIds]);
  return { ...query, isStartingSession: startingSession && !query.isError };
}

export function useRateFlashcardReviewCard(_topicId: string, _mode: 'due' | 'all') {
  return useMutation({
    mutationKey: flashcardAnswerMutationKey,
    mutationFn: (command: RateFlashcardCommand) => flashcardsApi.rateReviewCard(command),
  });
}
