import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { FilterPills } from '@/components/filter-pills';
import { NativePager } from '@/components/native-pager';
import { ErrorBlock, LoadingBlock, StudentScreen } from '@/components/student-ui';
import { flashcardApi } from '@/features/flashcards/flashcard-api';
import { FlashcardButton } from '@/features/flashcards/flashcard-controls';
import { flashcardKeys, useManageFlashcards } from '@/features/flashcards/flashcard-hooks';
import { filterFlashcardGroups, groupFlashcards, pageOf, type FlashcardManageFilters } from '@/features/flashcards/flashcard-manager-model';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

const states: FlashcardManageFilters['state'][] = ['all', 'New', 'Learning', 'Relearning', 'Review'];
const flags: FlashcardManageFilters['flag'][] = ['all', 'suspended', 'buried', 'leech'];
const sorts: FlashcardManageFilters['sort'][] = ['order', 'due', 'state'];

function labelFor(value: string) {
  if (value === 'leech') return 'Leech suggested';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function ManageFlashcardsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const cards = useManageFlashcards();
  const [filters, setFilters] = useState<FlashcardManageFilters>({ search: '', state: 'all', flag: 'all', sort: 'order', subjectId: 'all', topicIds: [] });
  const [page, setPage] = useState(0);
  const [unburyPending, setUnburyPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const groups = useMemo(() => groupFlashcards(cards.data ?? []), [cards.data]);
  const filtered = useMemo(() => filterFlashcardGroups(groups, filters), [groups, filters]);
  const window = pageOf(filtered, page);
  const subjects = useMemo(() => {
    const seen = new Map<string, string>();
    for (const card of cards.data ?? []) {
      if (!card.subject_id || seen.has(card.subject_id)) continue;
      seen.set(card.subject_id, card.subject_short_name?.trim() || 'Subject');
    }
    return [...seen.entries()].map(([id, label]) => ({ id, label })).sort((left, right) => left.label.localeCompare(right.label));
  }, [cards.data]);
  const topics = useMemo(() => {
    if (!filters.subjectId || filters.subjectId === 'all') return [];
    const seen = new Map<string, string>();
    for (const card of cards.data ?? []) {
      if (card.subject_id !== filters.subjectId || seen.has(card.topic_id)) continue;
      seen.set(card.topic_id, [card.topic_code, card.topic_name].filter(Boolean).join(' ') || 'Topic');
    }
    return [...seen.entries()].map(([id, label]) => ({ id, label })).sort((left, right) => left.label.localeCompare(right.label));
  }, [cards.data, filters.subjectId]);

  function update(next: Partial<FlashcardManageFilters>) {
    setFilters((current) => ({ ...current, ...next }));
    setPage(0);
  }

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
    <StudentScreen
      title="Manage flashcards"
      largeTitle={false}
      headerSearch={{ placeholder: 'Search flashcards', onChangeText: (search) => update({ search }) }}>
      {cards.isPending ? <LoadingBlock label="Loading your flashcards…" /> : null}
      {cards.isError ? <ErrorBlock message="Could not load flashcards. Check your connection and try again." /> : null}
      {cards.data ? (
        <View style={{ gap: 12 }}>
          {process.env.EXPO_OS === 'ios' ? null : (
            <TextInput
              accessibilityLabel="Search flashcards"
              placeholder="Search flashcards"
              placeholderTextColor={theme.textSecondary}
              value={filters.search}
              onChangeText={(search) => update({ search })}
              style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundElement, color: theme.text }}
            />
          )}
          <FilterPills choices={states.map((id) => ({ id, label: labelFor(id) }))} selected={filters.state} onSelect={(state) => update({ state })} />
          <FilterPills choices={flags.map((id) => ({ id, label: labelFor(id) }))} selected={filters.flag} onSelect={(flag) => update({ flag })} />
          <FilterPills choices={sorts.map((id) => ({ id, label: labelFor(id) }))} selected={filters.sort} onSelect={(sort) => update({ sort })} />
          <FilterPills
            choices={[{ id: 'all', label: 'All' }, ...subjects]}
            selected={filters.subjectId ?? 'all'}
            onSelect={(subjectId) => update({ subjectId, topicIds: [] })}
          />
          {filters.subjectId && filters.subjectId !== 'all' ? (
            <FilterPills
              choices={[{ id: 'all', label: 'All topics' }, ...topics]}
              selected={filters.topicIds && filters.topicIds.length > 0 ? filters.topicIds : ['all']}
              onSelect={(topicId) => {
                if (topicId === 'all') {
                  update({ topicIds: [] });
                  return;
                }
                const current = filters.topicIds ?? [];
                update({ topicIds: current.includes(topicId) ? current.filter((id) => id !== topicId) : [...current, topicId] });
              }}
            />
          ) : null}
          {message ? <Text selectable style={{ color: theme.textSecondary }}>{message}</Text> : null}
          {(cards.data ?? []).some((card) => card.buried_until) ? <FlashcardButton onPress={() => { void unburyAll(); }} disabled={unburyPending}>Unbury all</FlashcardButton> : null}
          <Text selectable style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>{filtered.length} flashcards</Text>
          <View style={{ backgroundColor: theme.backgroundElement, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' }}>
            {window.items.map((group, index) => (
              <Pressable
                key={group.id}
                accessibilityRole="button"
                onPressIn={() => haptic()}
                onPress={() => router.push({ pathname: '/flashcards/manage/[flashcardId]', params: { flashcardId: group.id } })}
                style={{ minHeight: 58, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center', borderTopWidth: index === 0 ? 0 : 0.5, borderTopColor: theme.border }}>
                <Text numberOfLines={1} style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{group.preview || `Flashcard ${group.cards[0].flashcard_index + 1}`}</Text>
                <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }}>
                  {`${[group.cards[0].subject_short_name, group.cards[0].topic_code].filter(Boolean).join(' · ')} · ${group.cards.length} cloze${group.cards.length === 1 ? '' : 's'}`}
                </Text>
              </Pressable>
            ))}
          </View>
          {filtered.length === 0 ? <Text selectable style={{ color: theme.textSecondary }}>No flashcards match these filters.</Text> : null}
          {window.pageCount > 1 ? (
            <NativePager actions={[
              { label: 'Previous', disabled: window.index === 0, onPress: () => setPage((current) => Math.max(0, current - 1)) },
              { label: `Page ${window.index + 1} of ${window.pageCount}`, disabled: true, onPress: () => undefined },
              { label: 'Next', disabled: window.index >= window.pageCount - 1, onPress: () => setPage((current) => current + 1) },
            ]} />
          ) : null}
        </View>
      ) : null}
    </StudentScreen>
  );
}
