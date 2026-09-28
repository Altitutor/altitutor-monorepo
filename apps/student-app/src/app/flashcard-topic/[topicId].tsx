import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { ErrorBlock, LoadingBlock, StudentScreen } from '@/components/student-ui';
import { FlashcardButton } from '@/features/flashcards/flashcard-controls';
import { useFlashcardTopic, useTopicFlashcardCards } from '@/features/flashcards/flashcard-hooks';
import { FreeFlashcardSession } from '@/features/flashcards/free-session';
import { useTheme } from '@/hooks/use-theme';

export default function TopicFlashcardsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const topic = useFlashcardTopic(topicId);
  const cards = useTopicFlashcardCards(topicId);

  if (cards.data && !topic.isPending && !topic.isError) {
    return (
      <>
        <Stack.Screen options={{ title: 'Topic flashcards' }} />
        <FreeFlashcardSession
          cards={cards.data}
          resetKey={cards.dataUpdatedAt}
          header={
            <View style={{ gap: 8 }}>
              <Text selectable style={{ color: theme.textSecondary }}>{topic.data?.due_review_card_count ?? 0} due · {topic.data?.review_card_count ?? 0} cards</Text>
              <FlashcardButton onPress={() => router.push({ pathname: '/flashcards/study', params: { topicId } })}>Study due cards from this topic</FlashcardButton>
            </View>
          }
        />
      </>
    );
  }

  return (
    <StudentScreen title="Topic flashcards" largeTitle={false} refreshing={cards.isRefetching} onRefresh={() => { void cards.refetch(); }}>
      {cards.isPending || topic.isPending ? <LoadingBlock label="Loading topic flashcards…" /> : null}
      {cards.isError || topic.isError ? <ErrorBlock message="Could not load topic flashcards. Check your connection and try again." /> : null}
    </StudentScreen>
  );
}
