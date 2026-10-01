import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import { Card, ErrorBlock, LoadingBlock, StudentScreen, TappableRow } from '@/components/student-ui';
import { FlashcardButton } from '@/features/flashcards/flashcard-controls';
import { useFlashcardSnapshot } from '@/features/flashcards/flashcard-hooks';
import { useTheme } from '@/hooks/use-theme';
import { openStudentWebPage } from '@/features/settings/open-web-profile';

export default function FlashcardsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const snapshot = useFlashcardSnapshot();
  const refetch = snapshot.refetch;

  useFocusEffect(useCallback(() => {
    void refetch();
  }, [refetch]));

  return (
    <StudentScreen title="Flashcards" showHeaderActions refreshing={snapshot.isRefetching} onRefresh={() => { void snapshot.refetch(); }}>
      {snapshot.isPending ? <LoadingBlock label="Loading flashcards…" /> : null}
      {snapshot.isError ? <ErrorBlock message="Could not load flashcards. Check your connection and try again." /> : null}
      {snapshot.data ? (
        <View style={{ gap: 14 }}>
          {snapshot.data.timezoneConfirmationRequired ? (
            <Card>
              <Text selectable style={{ color: theme.text }}>Confirm your study-day timezone in Flashcard settings. You can still study now.</Text>
              <FlashcardButton onPress={() => { void openStudentWebPage('/settings/flashcards'); }}>Open settings</FlashcardButton>
            </Card>
          ) : null}
          <Card>
            <TappableRow
              title="Study all"
              detail={`${snapshot.data.counts.total} due · ${snapshot.data.counts.new} new · ${snapshot.data.counts.learning + snapshot.data.counts.relearning} learning · ${snapshot.data.counts.review} review`}
              onPress={() => router.push('/flashcards/study')}
            />
          </Card>
          {snapshot.data.subjects.filter((subject) => subject.total > 0).map((subject) => (
            <Card key={subject.id}>
              <TappableRow
                title={subject.name}
                detail={`${subject.total} cards · ${subject.new} new · ${subject.learning} learning · ${subject.review} review`}
                onPress={() => router.push({ pathname: '/flashcards/study', params: { subjectId: subject.id } })}
              />
            </Card>
          ))}
          {snapshot.data.catalogTotal === 0 ? <Text selectable style={{ color: theme.textSecondary }}>No flashcards are available yet.</Text> : null}
          <FlashcardButton onPress={() => router.push('/(tabs)/flashcards/manage')}>Manage flashcards</FlashcardButton>
          <FlashcardButton onPress={() => { void openStudentWebPage('/settings/flashcards'); }}>Flashcard settings</FlashcardButton>
        </View>
      ) : null}
    </StudentScreen>
  );
}
