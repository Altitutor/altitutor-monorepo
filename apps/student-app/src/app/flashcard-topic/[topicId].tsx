import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ErrorBlock, LoadingBlock, StudentScreen } from '@/components/student-ui';
import { useFlashcardTopic, useTopicFlashcardCards } from '@/features/flashcards/flashcard-hooks';
import { FreeFlashcardSession } from '@/features/flashcards/free-session';

export default function TopicFlashcardsScreen() {
  const router = useRouter();
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const topic = useFlashcardTopic(topicId);
  const cards = useTopicFlashcardCards(topicId);
  const topicName = cards.data?.[0]?.topic_name?.trim() || topic.data?.title?.trim() || 'Topic';
  const title = `${topicName} flashcards free study`;

  if (cards.data && !topic.isPending && !topic.isError) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <FreeFlashcardSession
          cards={cards.data}
          resetKey={cards.dataUpdatedAt}
          onInfo={() => router.push({ pathname: '/free-study-info', params: { topicName } })}
          onStudyDue={() => router.push('/(tabs)/flashcards')}
        />
      </>
    );
  }

  return (
    <StudentScreen title={title} largeTitle={false}>
      {cards.isPending || topic.isPending ? <LoadingBlock label="Loading topic flashcards…" /> : null}
      {cards.isError || topic.isError ? <ErrorBlock message="Could not load topic flashcards. Check your connection and try again." /> : null}
    </StudentScreen>
  );
}
