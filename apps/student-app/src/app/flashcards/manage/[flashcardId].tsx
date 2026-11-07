import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { FilterPills } from '@/components/filter-pills';
import { ErrorBlock, LoadingBlock, StudentScreen } from '@/components/student-ui';
import { type FlashcardManageAction } from '@/features/flashcards/flashcard-api';
import { FlashcardContent } from '@/features/flashcards/flashcard-content';
import { FlashcardButton } from '@/features/flashcards/flashcard-controls';
import { flashcardKeys, useManageFlashcardAction, useManageFlashcards } from '@/features/flashcards/flashcard-hooks';
import { groupFlashcards } from '@/features/flashcards/flashcard-manager-model';
import { useTheme } from '@/hooks/use-theme';

export default function ManageFlashcardDetailScreen() {
  const { flashcardId } = useLocalSearchParams<{ flashcardId: string }>();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const cards = useManageFlashcards();
  const action = useManageFlashcardAction();
  const group = useMemo(() => groupFlashcards(cards.data ?? []).find((entry) => entry.id === flashcardId) ?? null, [cards.data, flashcardId]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const active = group?.cards.find((card) => card.id === selectedId) ?? group?.cards[0] ?? null;

  async function run(actionName: FlashcardManageAction) {
    if (!active || pending) return;
    setPending(true);
    setMessage(null);
    try {
      await action.mutateAsync({ reviewCardId: active.id, action: actionName, requestId: randomUUID() });
      const result = await cards.refetch();
      if (result.error) throw result.error;
      await queryClient.invalidateQueries({ queryKey: flashcardKeys.all });
      setMessage(`${actionName[0].toUpperCase()}${actionName.slice(1)} saved.`);
    } catch {
      setMessage('Could not confirm that change. The card list has been refreshed; please try again.');
      await cards.refetch();
    } finally {
      setPending(false);
    }
  }

  function confirmForget() {
    Alert.alert('Forget this review card?', 'Its schedule will reset to New. Review history is retained on the server.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Forget', style: 'destructive', onPress: () => { void run('forget'); } },
    ]);
  }

  return (
    <StudentScreen title="Review card" largeTitle={false}>
      {cards.isPending ? <LoadingBlock label="Loading review card…" /> : null}
      {cards.isError ? <ErrorBlock message="Could not load this flashcard." /> : null}
      {!active && !cards.isPending ? <ErrorBlock message="This flashcard is no longer available." /> : null}
      {active && group ? (
        <View style={{ gap: 14 }}>
          <Text selectable style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>
            {[active.subject_short_name, active.topic_code, active.topic_name].filter(Boolean).join(' · ')}
          </Text>
          <FilterPills
            choices={group.cards.map((reviewCard) => ({ id: reviewCard.id, label: `Cloze ${reviewCard.cloze_index}` }))}
            selected={active.id}
            onSelect={setSelectedId}
          />
          <Text selectable style={{ color: theme.textSecondary }}>
            {active.state} · {active.suspended_at ? 'Suspended' : active.buried_until ? 'Buried' : new Date(active.due_at) <= new Date() ? 'Due now' : `Due ${new Date(active.due_at).toLocaleString()}`}
            {active.leech_at ? ' · Leech suggested' : ''}
          </Text>
          <Text selectable style={{ color: theme.textSecondary, fontWeight: '700' }}>Front</Text>
          <FlashcardContent card={active} showAnswer={false} />
          <Text selectable style={{ color: theme.textSecondary, fontWeight: '700' }}>Answer</Text>
          <FlashcardContent card={active} showAnswer />
          {message ? <Text selectable style={{ color: theme.textSecondary }}>{message}</Text> : null}
          <FlashcardButton tone={active.suspended_at ? 'primary' : 'default'} onPress={() => { void run(active.suspended_at ? 'resume' : 'suspend'); }} disabled={pending}>
            {active.suspended_at ? 'Resume' : 'Suspend'}
          </FlashcardButton>
          <FlashcardButton tone={active.buried_until ? 'primary' : 'default'} onPress={() => { void run(active.buried_until ? 'unbury' : 'bury'); }} disabled={pending}>
            {active.buried_until ? 'Unbury' : 'Bury until tomorrow'}
          </FlashcardButton>
          <FlashcardButton tone="danger" onPress={confirmForget} disabled={pending}>Forget schedule</FlashcardButton>
        </View>
      ) : null}
    </StudentScreen>
  );
}
