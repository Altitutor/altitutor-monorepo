import { useLocalSearchParams, useRouter } from 'expo-router';

import { ErrorBlock, LoadingBlock, StudentScreen, Value } from '@/components/student-ui';
import { FlashcardButton } from '@/features/flashcards/flashcard-controls';
import { useFlashcardTopic, useTopicFlashcardCards } from '@/features/flashcards/flashcard-hooks';
import { FreeFlashcardSession } from '@/features/flashcards/free-session';

export default function TopicFlashcardsScreen() {
  const router = useRouter();
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const topic = useFlashcardTopic(topicId);
  const cards = useTopicFlashcardCards(topicId);

  return (
    <StudentScreen title="Topic flashcards" largeTitle={false} refreshing={cards.isRefetching} onRefresh={() => { void cards.refetch(); }}>
      {topic.data ? <Value>{`${topic.data.due_review_card_count ?? 0} due · ${topic.data.review_card_count ?? 0} cards`}</Value> : null}
      <FlashcardButton onPress={() => router.push({ pathname: '/(tabs)/flashcards/study', params: { topicId } })}>Study due cards from this topic</FlashcardButton>
      {cards.isPending || topic.isPending ? <LoadingBlock label="Loading topic flashcards…" /> : null}
      {cards.isError || topic.isError ? <ErrorBlock message="Could not load topic flashcards. Check your connection and try again." /> : null}
      {cards.data ? <FreeFlashcardSession cards={cards.data} resetKey={cards.dataUpdatedAt} /> : null}
    </StudentScreen>
  );
}
