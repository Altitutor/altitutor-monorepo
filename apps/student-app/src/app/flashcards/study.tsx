import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect } from 'react';

import { ErrorBlock, LoadingBlock, StudentScreen } from '@/components/student-ui';
import { DueFlashcardSession } from '@/features/flashcards/due-session';
import { useFlashcardSnapshot } from '@/features/flashcards/flashcard-hooks';

export default function DueFlashcardsScreen() {
  const { subjectId, topicId } = useLocalSearchParams<{ subjectId?: string; topicId?: string }>();
  const menu = useFlashcardSnapshot();
  const selectedSubject = subjectId ? menu.data?.subjects.find((subject) => subject.id === subjectId) : null;
  const topicIds = topicId ? [topicId] : subjectId ? selectedSubject?.topicIds ?? [] : undefined;
  const filtered = useFlashcardSnapshot(topicIds);
  const active = topicIds === undefined ? menu : filtered;
  const title = topicId ? 'Topic review' : selectedSubject?.name ?? 'Study all';
  const refetchMenu = menu.refetch;
  const refetchFiltered = filtered.refetch;
  const hasFilteredTopics = Boolean(topicIds?.length);
  const refetchActive = active.refetch;
  const nextDueAt = active.data?.nextDueAt;

  useFocusEffect(useCallback(() => {
    void refetchMenu();
    if (hasFilteredTopics) void refetchFiltered();
  }, [refetchMenu, refetchFiltered, hasFilteredTopics]));

  useEffect(() => {
    if (!nextDueAt) return;
    const dueTime = new Date(nextDueAt).getTime();
    if (!Number.isFinite(dueTime)) return;
    const timer = setInterval(() => {
      if (new Date().getTime() >= dueTime) void refetchActive();
    }, 30_000);
    return () => clearInterval(timer);
  }, [nextDueAt, refetchActive]);

  const refresh = useCallback(async () => {
    const result = await refetchActive();
    if (result.error) throw result.error;
  }, [refetchActive]);

  if (active.data && !(subjectId && menu.data && !selectedSubject)) {
    return (
      <DueFlashcardSession snapshot={active.data} resetKey={active.dataUpdatedAt} onRefresh={refresh} title={title} />
    );
  }

  return (
    <StudentScreen title={title} largeTitle={false} refreshing={active.isRefetching} onRefresh={() => { void refresh().catch(() => undefined); }}>
      <Stack.Screen options={{ title }} />
      {subjectId && menu.data && !selectedSubject ? <ErrorBlock message="This subject has no accessible flashcards." /> : null}
      {active.isPending ? <LoadingBlock label="Loading due cards…" /> : null}
      {active.isError ? <ErrorBlock message="Could not load your study queue. Check your connection and try again." /> : null}
    </StudentScreen>
  );
}
