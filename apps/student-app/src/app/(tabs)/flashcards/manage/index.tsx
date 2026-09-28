import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Card, ErrorBlock, LoadingBlock, StudentScreen, TappableRow } from '@/components/student-ui';
import { flashcardApi } from '@/features/flashcards/flashcard-api';
import { FlashcardButton } from '@/features/flashcards/flashcard-controls';
import { flashcardKeys, useManageFlashcards } from '@/features/flashcards/flashcard-hooks';
import { filterFlashcardGroups, groupFlashcards, type FlashcardManageFilters } from '@/features/flashcards/flashcard-manager-model';
import { useTheme } from '@/hooks/use-theme';

const states: FlashcardManageFilters['state'][] = ['all', 'New', 'Learning', 'Relearning', 'Review'];
const flags: FlashcardManageFilters['flag'][] = ['all', 'suspended', 'buried', 'leech'];
const sorts: FlashcardManageFilters['sort'][] = ['order', 'due', 'state'];

function FilterChoices<T extends string>({ choices, selected, onSelect }: { choices: T[]; selected: T; onSelect: (value: T) => void }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {choices.map((choice) => (
        <Pressable key={choice} accessibilityRole="button" accessibilityState={{ selected: choice === selected }} onPress={() => onSelect(choice)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: choice === selected ? theme.primary : theme.backgroundElement, borderWidth: 1, borderColor: theme.border }}>
          <Text style={{ color: choice === selected ? theme.backgroundElement : theme.text, textTransform: 'capitalize' }}>{choice === 'leech' ? 'Leech suggested' : choice}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export default function ManageFlashcardsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const cards = useManageFlashcards();
  const refetch = cards.refetch;
  const [filters, setFilters] = useState<FlashcardManageFilters>({ search: '', state: 'all', flag: 'all', sort: 'order' });
  const [visibleCount, setVisibleCount] = useState(80);
  const [unburyPending, setUnburyPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const groups = useMemo(() => groupFlashcards(cards.data ?? []), [cards.data]);
  const filtered = useMemo(() => filterFlashcardGroups(groups, filters), [groups, filters]);

  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));

  async function unburyAll() {
    const buried = (cards.data ?? []).filter((card) => card.buried_until);
    if (buried.length === 0) return;
    setUnburyPending(true);
    setMessage(null);
    try {
      for (const card of buried) await flashcardApi.manage(card.id, 'unbury', randomUUID());
      await cards.refetch();
      await queryClient.invalidateQueries({ queryKey: flashcardKeys.all });
      setMessage(`${buried.length} review cards unburied.`);
    } catch {
      await cards.refetch();
      setMessage('Some cards could not be unburied. The list has been refreshed; please try again.');
    } finally {
      setUnburyPending(false);
    }
  }

  return (
    <StudentScreen title="Manage flashcards" largeTitle={false} refreshing={cards.isRefetching} onRefresh={() => { void cards.refetch(); }}>
      {cards.isPending ? <LoadingBlock label="Loading your flashcards…" /> : null}
      {cards.isError ? <ErrorBlock message="Could not load flashcards. Check your connection and try again." /> : null}
      {cards.data ? (
        <View style={{ gap: 14 }}>
          <TextInput
            accessibilityLabel="Search flashcards"
            placeholder="Search flashcards…"
            placeholderTextColor={theme.textSecondary}
            value={filters.search}
            onChangeText={(search) => { setFilters((current) => ({ ...current, search })); setVisibleCount(80); }}
            style={{ minHeight: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundElement, color: theme.text }}
          />
          <Text selectable style={{ color: theme.textSecondary }}>Study state</Text>
          <FilterChoices choices={states} selected={filters.state} onSelect={(state) => { setFilters((current) => ({ ...current, state })); setVisibleCount(80); }} />
          <Text selectable style={{ color: theme.textSecondary }}>Card status</Text>
          <FilterChoices choices={flags} selected={filters.flag} onSelect={(flag) => { setFilters((current) => ({ ...current, flag })); setVisibleCount(80); }} />
          <Text selectable style={{ color: theme.textSecondary }}>Sort by</Text>
          <FilterChoices choices={sorts} selected={filters.sort} onSelect={(sort) => setFilters((current) => ({ ...current, sort }))} />
          {message ? <Text selectable style={{ color: theme.textSecondary }}>{message}</Text> : null}
          {(cards.data ?? []).some((card) => card.buried_until) ? <FlashcardButton onPress={() => { void unburyAll(); }} disabled={unburyPending}>Unbury all</FlashcardButton> : null}
          <Text selectable style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>{filtered.length} of {groups.length} flashcards</Text>
          {filtered.slice(0, visibleCount).map((group) => (
            <Card key={group.id}>
              <TappableRow
                title={group.preview || `Flashcard ${group.cards[0].flashcard_index + 1}`}
                detail={`${[group.cards[0].subject_short_name, group.cards[0].topic_code].filter(Boolean).join(' · ')} · ${group.cards.length} cloze${group.cards.length === 1 ? '' : 's'} · ${new Date(group.dueAt).toLocaleDateString()}`}
                onPress={() => router.push({ pathname: '/(tabs)/flashcards/manage/[flashcardId]', params: { flashcardId: group.id } })}
              />
            </Card>
          ))}
          {filtered.length === 0 ? <Text selectable style={{ color: theme.textSecondary }}>No flashcards match these filters.</Text> : null}
          {filtered.length > visibleCount ? <FlashcardButton onPress={() => setVisibleCount((current) => current + 80)}>Show more</FlashcardButton> : null}
        </View>
      ) : null}
    </StudentScreen>
  );
}
