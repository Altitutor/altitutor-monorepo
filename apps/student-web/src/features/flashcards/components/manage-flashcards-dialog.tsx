'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import type { DataTableState, FlashcardReviewCard } from '@altitutor/shared';
import { getImageOcclusionGroupDescription, parseClozeParts } from '@altitutor/shared';
import {
  Badge,
  Button,
  DataTableToolbar,
  ImageOcclusionViewer,
  ScrollArea,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TablePagination,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { StudentDialogShell } from '@/shared/components';
import { studentCardCn, studentTableBodyRow, studentTableHeaderRow } from '@/shared/lib/student-visual';
import { cn, getSubjectColorStyle } from '@/shared/utils';
import { resourcesApi } from '@/features/resources/api/resources';
import type { ResourceSubject } from '@/features/resources/lib/types';
import type { FlashcardHistoryEntry, FlashcardManagementAction, FlashcardManagementResult } from '../types/management';

export type FlashcardManageFilter = 'all' | FlashcardReviewCard['state'];

type FlashcardGroup = {
  id: string;
  cards: FlashcardReviewCard[];
  preview: string;
  states: FlashcardReviewCard['state'][];
  nextDueAt: string;
};

const defaultColumns = ['card', 'state', 'clozes', 'due'];

function ManageButton({ help, ...props }: ComponentProps<typeof Button> & { help: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild><Button {...props} /></TooltipTrigger>
      <TooltipContent className="max-w-xs">{help}</TooltipContent>
    </Tooltip>
  );
}

function createTableState(filter: FlashcardManageFilter): DataTableState {
  return {
    search: '',
    filters: filter === 'all' ? {} : { state: [filter] },
    sortBy: 'order',
    sortDirection: 'asc',
    groupBy: null,
    page: 1,
    pageSize: 20,
    visibleColumns: defaultColumns,
    defaultVisibleColumns: defaultColumns,
  };
}

function plainCardPreview(card: FlashcardReviewCard): string {
  const source = card.cloze_text ?? card.image_alt_text ?? `Flashcard ${card.flashcard_index + 1}`;
  return source
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{\{c\d+::(.*?)(?:::[^}]*)?}}/g, '$1')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function clozeHtml(card: FlashcardReviewCard, showAnswer: boolean): string {
  return parseClozeParts(card.cloze_text ?? '', card.cloze_index)
    .map((part) => {
      if (part.type === 'text') return part.text;
      if (!part.active) return part.answer;
      const className = showAnswer
        ? 'rounded-md bg-accent px-2 py-1 font-semibold text-brand-dark-bg'
        : 'rounded-md bg-muted px-2 py-1 font-semibold text-muted-foreground';
      return `<span class="${className}">${showAnswer ? part.answer : part.hint ? `... (${part.hint})` : '...'}</span>`;
    })
    .join('');
}

function stateRank(state: FlashcardReviewCard['state']): number {
  return ['New', 'Learning', 'Relearning', 'Review'].indexOf(state);
}

const stateBadgeClassName = 'whitespace-nowrap border-border/60 bg-muted/60 font-medium text-muted-foreground';

function isBuried(card: FlashcardReviewCard) {
  return Boolean(card.buried_until && new Date(card.buried_until) > new Date());
}

function GroupState({ group }: { group: FlashcardGroup }) {
  const suspended = group.cards.filter((card) => card.suspended_at).length;
  const buried = group.cards.filter(isBuried).length;
  return (
    <div className="min-w-36 space-y-1.5">
      <Badge variant="secondary" className={stateBadgeClassName}>{group.states.length === 1 ? group.states[0] : 'Mixed'}</Badge>
      {group.states.length > 1 ? <p className="text-xs text-muted-foreground">{group.states.map((state) => `${state} ${group.cards.filter((card) => card.state === state).length}`).join(' · ')}</p> : null}
      {suspended || buried ? <div className="flex flex-wrap gap-1">
        {suspended ? <Badge variant="outline" className={stateBadgeClassName}>Suspended {suspended}</Badge> : null}
        {buried ? <Badge variant="outline" className={stateBadgeClassName}>Buried {buried}</Badge> : null}
      </div> : null}
    </div>
  );
}

function GroupProperties({ group, subjects, visibleColumns }: { group: FlashcardGroup; subjects: ResourceSubject[]; visibleColumns: string[] }) {
  const first = group.cards[0];
  const subject = subjects.find((item) => item.id === first.subject_id);
  const subjectColor = subject?.color ? getSubjectColorStyle(subject) : null;
  const retention = group.cards.flatMap((card) => card.state === 'Review' && typeof card.retrievability === 'number' && Number.isFinite(card.retrievability) ? [Math.round(card.retrievability * 100)] : []);
  const lowestRetention = Math.min(...retention);
  const highestRetention = Math.max(...retention);
  const retentionLabel = !retention.length ? '—' : lowestRetention === highestRetention ? `${lowestRetention}%` : `${lowestRetention}–${highestRetention}%`;
  return <>
    {visibleColumns.includes('subject') ? <TableCell><Badge variant="secondary" style={subjectColor?.style} className={subjectColor?.textColorClass}>{subject?.short_name ?? first.subject_short_name ?? subject?.name ?? '—'}</Badge></TableCell> : null}
    {visibleColumns.includes('topic') ? <TableCell className="text-xs">{[first.topic_code, first.topic_name].filter(Boolean).join(' · ') || '—'}</TableCell> : null}
    {visibleColumns.includes('retention') ? <TableCell className="text-xs text-muted-foreground"><span title="Current estimated recall for reviewed clozes; a range means the clozes differ.">{retentionLabel}</span></TableCell> : null}
    {visibleColumns.includes('reviews') ? <TableCell>{group.cards.reduce((total, card) => total + card.reps, 0)}</TableCell> : null}
  </>;
}

function formatDueDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return date <= new Date() ? 'Due now' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function FrontBackPreview({ card }: { card: FlashcardReviewCard }) {
  const isImageCard = card.card_type === 'image_occlusion' && card.image_url && card.occlusion_data;
  const imageDescription = getImageOcclusionGroupDescription(card.occlusion_data, card.cloze_index);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className={studentCardCn('space-y-3 p-4')}>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Front</p>
        {isImageCard ? (
          <ImageOcclusionViewer
            imageUrl={card.image_url!}
            alt={card.image_alt_text ?? ''}
            data={card.occlusion_data!}
            activeClozeIndex={card.cloze_index}
            showAnswer={false}
          />
        ) : (
          <div
            className="prose prose-sm max-w-none whitespace-pre-wrap leading-7 dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: clozeHtml(card, false) }}
          />
        )}
      </section>

      <section className={studentCardCn('space-y-3 p-4')}>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Back</p>
        {isImageCard ? (
          <div className="space-y-3">
            <ImageOcclusionViewer
              imageUrl={card.image_url!}
              alt={card.image_alt_text ?? ''}
              data={card.occlusion_data!}
              activeClozeIndex={card.cloze_index}
              showAnswer
            />
            {imageDescription ? <p className="text-sm">{imageDescription}</p> : null}
          </div>
        ) : (
          <div
            className="prose prose-sm max-w-none whitespace-pre-wrap leading-7 dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: clozeHtml(card, true) }}
          />
        )}
        {card.extra ? (
          <div
            className="prose prose-sm max-w-none rounded-xl bg-muted/40 p-3 leading-6 dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: card.extra }}
          />
        ) : null}
      </section>
    </div>
  );
}

export function ManageFlashcardsDialog({
  open,
  onOpenChange,
  initialFilter = 'all',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFilter?: FlashcardManageFilter;
}) {
  const [cards, setCards] = useState<FlashcardReviewCard[]>([]);
  const [subjects, setSubjects] = useState<ResourceSubject[]>([]);
  const [activeView, setActiveView] = useState('all');
  const [history, setHistory] = useState<FlashcardHistoryEntry[]>([]);
  const [tableState, setTableState] = useState<DataTableState>(() => createTableState(initialFilter));
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedReviewCardId, setSelectedReviewCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingRequestIds = useRef(new Map<string, string>());

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cardsResponse, historyResponse, enrolledSubjects] = await Promise.all([
        fetch('/api/flashcards/review-cards?mode=all', { cache: 'no-store' }),
        fetch('/api/flashcards/review-cards/history', { cache: 'no-store' }),
        resourcesApi.getMySubjects(),
      ]);
      if (!cardsResponse.ok || !historyResponse.ok) throw new Error('Unable to load flashcards');
      const [cardsResult, historyResult] = await Promise.all([cardsResponse.json(), historyResponse.json()]);
      setCards(cardsResult.data ?? []);
      setHistory(historyResult.data ?? []);
      setSubjects(enrolledSubjects);
      pendingRequestIds.current.clear();
    } catch (loadError) {
      console.error('Failed to load flashcard manager:', loadError);
      setError('Could not load your flashcards. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setTableState(createTableState(initialFilter));
    setActiveView('all');
    void load();
  }, [initialFilter, load, open]);

  const groups = useMemo<FlashcardGroup[]>(() => {
    const byFlashcard = new Map<string, FlashcardReviewCard[]>();
    for (const card of cards) {
      const current = byFlashcard.get(card.flashcard_id) ?? [];
      current.push(card);
      byFlashcard.set(card.flashcard_id, current);
    }
    return [...byFlashcard.entries()].map(([id, groupCards]) => {
      const sortedCards = groupCards.toSorted((a, b) => a.cloze_index - b.cloze_index);
      return {
        id,
        cards: sortedCards,
        preview: plainCardPreview(sortedCards[0]),
        states: [...new Set(sortedCards.map((card) => card.state))],
        nextDueAt: sortedCards.reduce((earliest, card) => card.due_at < earliest ? card.due_at : earliest, sortedCards[0].due_at),
      };
    });
  }, [cards]);

  const filteredGroups = useMemo(() => {
    const search = tableState.search.trim().toLowerCase();
    const selectedStates = (tableState.filters.state ?? []).map(String);
    const selectedFlags = (tableState.filters.flag ?? []).map(String);
    const selectedSubjects = (tableState.filters.subject ?? []).map(String);
    const selectedTopics = (tableState.filters.topic ?? []).map(String);
    const filtered = groups.filter((group) => {
      const searchable = [
        group.preview,
        ...group.cards.flatMap((card) => [card.topic_code ?? '', card.topic_name ?? '', card.subject_short_name ?? '']),
      ].join(' ').toLowerCase();
      if (search && !searchable.includes(search)) return false;
      const subjectId = group.cards[0].subject_id;
      if (activeView !== 'all' && subjectId !== activeView) return false;
      if (selectedSubjects.length && !selectedSubjects.includes(subjectId ?? '')) return false;
      if (selectedTopics.length && !selectedTopics.includes(group.cards[0].topic_id)) return false;
      if (selectedStates.length && !group.cards.some((card) => selectedStates.includes(card.state))) return false;
      if (selectedFlags.length && !group.cards.some((card) =>
        (selectedFlags.includes('suspended') && Boolean(card.suspended_at)) ||
        (selectedFlags.includes('buried') && isBuried(card)) ||
        (selectedFlags.includes('leech') && Boolean(card.leech_at))
      )) return false;
      return true;
    });
    return filtered.toSorted((a, b) => {
      let comparison = 0;
      if (tableState.sortBy === 'due') comparison = a.nextDueAt.localeCompare(b.nextDueAt);
      else if (tableState.sortBy === 'state') comparison = stateRank(a.states[0]) - stateRank(b.states[0]);
      else comparison = a.cards[0].flashcard_index - b.cards[0].flashcard_index;
      return tableState.sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [activeView, groups, tableState]);

  const currentPage = Math.min(tableState.page, Math.max(1, Math.ceil(filteredGroups.length / tableState.pageSize)));
  const pageGroups = useMemo(() => filteredGroups.slice((currentPage - 1) * tableState.pageSize, currentPage * tableState.pageSize), [currentPage, filteredGroups, tableState.pageSize]);

  useEffect(() => {
    if (pageGroups.some((group) => group.id === selectedGroupId)) return;
    setSelectedGroupId(pageGroups[0]?.id ?? null);
  }, [pageGroups, selectedGroupId]);

  const selectedGroup = filteredGroups.find((group) => group.id === selectedGroupId) ?? null;

  useEffect(() => {
    if (selectedGroup?.cards.some((card) => card.id === selectedReviewCardId)) return;
    setSelectedReviewCardId(selectedGroup?.cards[0]?.id ?? null);
  }, [selectedGroup, selectedReviewCardId]);

  const activeCard = selectedGroup?.cards.find((card) => card.id === selectedReviewCardId) ?? selectedGroup?.cards[0] ?? null;
  const activeHistory = activeCard ? history.filter((row) => row.review_card_id === activeCard.id) : [];

  const saveCommand = async (card: FlashcardReviewCard, action: FlashcardManagementAction) => {
    const commandKey = `${card.id}:${action}`;
    const requestId = pendingRequestIds.current.get(commandKey) ?? crypto.randomUUID();
    pendingRequestIds.current.set(commandKey, requestId);
    const response = await fetch(`/api/flashcards/review-cards/${encodeURIComponent(card.id)}/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, requestId }),
    });
    if (!response.ok) throw new Error('Command failed');
    const { data } = await response.json() as { data: Partial<FlashcardManagementResult> };
    if (!data.cardState || !data.historyEntry) throw new Error('saved_change_needs_refresh');
    const { cardState, historyEntry } = data;
    setCards((current) => current.map((item) => item.id === card.id ? { ...item, ...cardState } : item));
    setHistory((current) => [historyEntry, ...current.filter((entry) => entry.id !== historyEntry.id)]);
    for (const key of pendingRequestIds.current.keys()) {
      if (key.startsWith(`${card.id}:`)) pendingRequestIds.current.delete(key);
    }
  };

  const command = async (card: FlashcardReviewCard, action: FlashcardManagementAction) => {
    if (action === 'forget' && !window.confirm('Reset this card to New? Its review history will be retained.')) return;
    setPendingCardId(card.id);
    setError(null);
    try {
      await saveCommand(card, action);
    } catch (commandError) {
      console.error('Failed to manage flashcard:', commandError);
      setError(commandError instanceof Error && commandError.message === 'saved_change_needs_refresh'
        ? 'Your change was saved, but could not be refreshed. Retry the same action to refresh it safely.'
        : 'We could not confirm that change. Retry the same action safely.');
    } finally {
      setPendingCardId(null);
    }
  };

  const unburyAll = async () => {
    const buriedCards = cards.filter(isBuried);
    setPendingCardId('all');
    setError(null);
    try {
      const results = await Promise.allSettled(buriedCards.map((card) => saveCommand(card, 'unbury')));
      if (results.some((result) => result.status === 'rejected')) throw new Error('Unable to unbury every card');
    } catch (commandError) {
      console.error('Failed to unbury flashcards:', commandError);
      setError('Some cards could not be confirmed as unburied. Retry Unbury all to safely finish or refresh them.');
    } finally {
      setPendingCardId(null);
    }
  };

  const isColumnVisible = (column: string) => tableState.visibleColumns.includes(column);

  return (
    <TooltipProvider delayDuration={200}>
      <StudentDialogShell
        open={open}
        onOpenChange={onOpenChange}
        title="Manage flashcards"
        description="Search your cards, inspect each cloze, and manage its study state."
        contentClassName="sm:h-[min(92dvh,900px)] sm:max-h-[min(92dvh,900px)]"
        headerActions={cards.some(isBuried) ? (
          <ManageButton help="Make every buried cloze available for study again. Suspended clozes stay suspended." variant="outline" size="sm" onClick={() => void unburyAll()} disabled={Boolean(pendingCardId)}>
            Unbury all
          </ManageButton>
        ) : null}
      >
        <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:grid-rows-[minmax(0,1fr)]">
          <section className="flex min-h-0 min-w-0 flex-col border-b border-border/60 lg:border-b-0 lg:border-r" aria-label="Flashcard list">
            <div className="shrink-0 space-y-3 border-b border-border/60 p-4">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Flashcard views">
                {[{ id: 'all', label: 'All flashcards' }, ...subjects.flatMap((subject) => subject.id ? [{ id: subject.id, label: subject.short_name ?? subject.name ?? 'Subject' }] : [])].map((view) => (
                  <Button key={view.id} variant={activeView === view.id ? 'secondary' : 'ghost'} size="sm" className="rounded-full" aria-pressed={activeView === view.id} onClick={() => {
                    setActiveView(view.id);
                    setTableState((current) => ({ ...current, filters: {}, search: '', page: 1 }));
                  }}>{view.label}</Button>
                ))}
              </div>
              <DataTableToolbar
                state={tableState}
                onSearchChange={(search) => setTableState((current) => ({ ...current, search, page: 1 }))}
                onFiltersChange={(filters) => setTableState((current) => ({ ...current, filters, page: 1 }))}
                onSortChange={(sortBy, sortDirection) => setTableState((current) => ({ ...current, sortBy, sortDirection, page: 1 }))}
                onGroupByChange={() => undefined}
                onVisibleColumnsChange={(visibleColumns) => setTableState((current) => ({ ...current, visibleColumns }))}
                onQuickFilterApply={() => undefined}
                onReset={() => { setActiveView('all'); setTableState(createTableState('all')); }}
                searchPlaceholder="Search flashcards…"
                filterDefinitions={[
                  { key: 'subject', label: 'Subject', searchable: true, options: subjects.flatMap((subject) => subject.id ? [{ value: subject.id, label: subject.long_name ?? subject.name ?? subject.short_name ?? 'Subject' }] : []) },
                  { key: 'topic', label: 'Topic', searchable: true, options: [...new Map(cards.filter((card) => (activeView === 'all' || card.subject_id === activeView) && (!tableState.filters.subject?.length || tableState.filters.subject.includes(card.subject_id ?? ''))).map((card) => [card.topic_id, { value: card.topic_id, label: [card.topic_code, card.topic_name].filter(Boolean).join(' · ') || 'Topic' }])).values()] },
                  { key: 'state', label: 'Study state', options: ['New', 'Learning', 'Relearning', 'Review'].map((value) => ({ label: value, value })) },
                  { key: 'flag', label: 'Card status', options: [
                    { label: 'Suspended', value: 'suspended' },
                    { label: 'Buried', value: 'buried' },
                    { label: 'Leech suggested', value: 'leech' },
                  ] },
                ]}
                sortOptions={[
                  { key: 'order', label: 'Card order' },
                  { key: 'due', label: 'Next due' },
                  { key: 'state', label: 'Study state' },
                ]}
                columnDefinitions={[
                  { key: 'card', label: 'Card', visibleByDefault: true },
                  { key: 'state', label: 'Study state', visibleByDefault: true },
                  { key: 'clozes', label: 'Clozes', visibleByDefault: true },
                  { key: 'due', label: 'Next due', visibleByDefault: true },
                  { key: 'subject', label: 'Subject', visibleByDefault: false },
                  { key: 'topic', label: 'Topic', visibleByDefault: false },
                  { key: 'retention', label: 'Retention', visibleByDefault: false },
                  { key: 'reviews', label: 'Number of reviews', visibleByDefault: false },
                ]}
                defaultVisibleColumns={defaultColumns}
                compact
              />
              <p className="text-xs text-muted-foreground">{filteredGroups.length} of {groups.length} flashcards</p>
              <p className="text-xs text-muted-foreground">Each cloze has one study state. Mixed means the clozes in a flashcard have different states.</p>
              {error ? <div role="alert" className="text-sm text-destructive">{error}{!cards.length ? <Button variant="link" onClick={() => void load()}>Retry</Button> : null}</div> : null}
            </div>

            <ScrollArea className="h-0 min-h-0 flex-1">
              {isLoading ? (
                <div className="flex h-48 items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading flashcards…
                </div>
              ) : filteredGroups.length ? (
                <Table className="min-w-[520px]">
                  <TableHeader>
                    <TableRow className={studentTableHeaderRow}>
                      {isColumnVisible('card') ? <TableHead>Card</TableHead> : null}
                      {isColumnVisible('state') ? <TableHead>State</TableHead> : null}
                      {isColumnVisible('clozes') ? <TableHead className="w-20">Clozes</TableHead> : null}
                      {isColumnVisible('due') ? <TableHead>Next due</TableHead> : null}
                      {isColumnVisible('subject') ? <TableHead>Subject</TableHead> : null}
                      {isColumnVisible('topic') ? <TableHead>Topic</TableHead> : null}
                      {isColumnVisible('retention') ? <TableHead>Retention</TableHead> : null}
                      {isColumnVisible('reviews') ? <TableHead>Reviews</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageGroups.map((group) => (
                      <TableRow
                        key={group.id}
                        role="row"
                        tabIndex={0}
                        aria-selected={selectedGroupId === group.id}
                        data-state={selectedGroupId === group.id ? 'selected' : undefined}
                        className={cn(studentTableBodyRow, 'cursor-pointer')}
                        onClick={() => setSelectedGroupId(group.id)}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return;
                          event.preventDefault();
                          setSelectedGroupId(group.id);
                        }}
                      >
                        {isColumnVisible('card') ? (
                          <TableCell className="max-w-[16rem]">
                            <p className="truncate font-medium">{group.preview || `Flashcard ${group.cards[0].flashcard_index + 1}`}</p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {[group.cards[0].subject_short_name, group.cards[0].topic_code].filter(Boolean).join(' · ') || 'Flashcard'}
                            </p>
                          </TableCell>
                        ) : null}
                        {isColumnVisible('state') ? (
                          <TableCell>
                            <GroupState group={group} />
                          </TableCell>
                        ) : null}
                        {isColumnVisible('clozes') ? <TableCell>{group.cards.length}</TableCell> : null}
                        {isColumnVisible('due') ? <TableCell className="text-xs text-muted-foreground">{formatDueDate(group.nextDueAt)}</TableCell> : null}
                        <GroupProperties group={group} subjects={subjects} visibleColumns={tableState.visibleColumns} />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">No flashcards match these filters.</div>
              )}
            </ScrollArea>
            <div className="shrink-0 border-t border-border/60 p-3">
              <TablePagination page={currentPage} pageSize={tableState.pageSize} total={filteredGroups.length} isFetching={isLoading} onPageChange={(page) => setTableState((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setTableState((current) => ({ ...current, pageSize, page: 1 }))} />
            </div>
          </section>

          <section className="min-h-0 min-w-0 bg-muted/15" aria-label="Selected flashcard details">
            <ScrollArea className="h-full">
              {selectedGroup && activeCard ? (
                <div className="space-y-5 p-4 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {[activeCard.subject_short_name, activeCard.topic_code, activeCard.topic_name].filter(Boolean).join(' · ')}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold">Flashcard {activeCard.flashcard_index + 1}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeCard.suspended_at ? (
                        <ManageButton help="Allow this cloze to appear in scheduled study again, keeping its progress." size="sm" onClick={() => void command(activeCard, 'resume')} disabled={Boolean(pendingCardId)}>Resume</ManageButton>
                      ) : (
                        <ManageButton help="Pause this cloze indefinitely until you resume it. Its progress and history are kept." size="sm" variant="outline" onClick={() => void command(activeCard, 'suspend')} disabled={Boolean(pendingCardId)}>Suspend</ManageButton>
                      )}
                      {isBuried(activeCard) ? (
                        <ManageButton help="Make this cloze available before the next study day. Its schedule is kept." size="sm" onClick={() => void command(activeCard, 'unbury')} disabled={Boolean(pendingCardId)}>Unbury</ManageButton>
                      ) : (
                        <ManageButton help="Hide this cloze until your next study day, which starts at 4 am in your saved timezone." size="sm" variant="outline" onClick={() => void command(activeCard, 'bury')} disabled={Boolean(pendingCardId)}>Bury</ManageButton>
                      )}
                      <ManageButton help="Reset this cloze to New and clear its scheduling progress. Review history is retained." size="sm" variant="destructive" onClick={() => void command(activeCard, 'forget')} disabled={Boolean(pendingCardId)}>Forget</ManageButton>
                    </div>
                  </div>

                  <Tabs value={activeCard.id} onValueChange={setSelectedReviewCardId}>
                    <TabsList className="w-full justify-start">
                      {selectedGroup.cards.map((reviewCard) => (
                        <Tooltip key={reviewCard.id}>
                          <TooltipTrigger asChild>
                            <TabsTrigger value={reviewCard.id}>Cloze {reviewCard.cloze_index}</TabsTrigger>
                          </TooltipTrigger>
                          <TooltipContent>Inspect the question, answer and history for cloze {reviewCard.cloze_index}.</TooltipContent>
                        </Tooltip>
                      ))}
                    </TabsList>
                    {selectedGroup.cards.map((reviewCard) => (
                      <TabsContent key={reviewCard.id} value={reviewCard.id} className="mt-4 space-y-4">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <Badge variant="secondary" className={stateBadgeClassName}>{reviewCard.state}</Badge>
                          {reviewCard.suspended_at ? <Badge variant="outline">Suspended</Badge> : null}
                          {isBuried(reviewCard) ? <Badge variant="outline">Buried</Badge> : null}
                          {reviewCard.leech_at ? <Badge variant="outline" className={stateBadgeClassName}>Leech suggested</Badge> : null}
                          <span className="text-muted-foreground">{formatDueDate(reviewCard.due_at)}</span>
                        </div>
                        <FrontBackPreview card={reviewCard} />
                      </TabsContent>
                    ))}
                  </Tabs>

                  <div className={studentCardCn('p-4')}>
                    <h4 className="text-sm font-semibold">Review history</h4>
                    {activeHistory.length ? (
                      <div className="mt-3 space-y-2">
                        {activeHistory.map((row) => (
                          <div key={row.id} className="rounded-xl bg-muted/40 p-3 text-xs">
                            <p className="font-medium">{new Date(row.answered_at).toLocaleString()} · {row.rating ?? row.action}{row.undone_at ? ' · undone' : ''}</p>
                            <p className="mt-1 text-muted-foreground">
                              {String(row.pre_state.state ?? '—')} → {String(row.post_state.state ?? '—')}
                              {row.duration_ms != null ? ` · ${Math.round(row.duration_ms / 1000)}s` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">No review history for this cloze yet.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[260px] items-center justify-center p-8 text-center text-sm text-muted-foreground">
                  Select a flashcard to inspect its clozes.
                </div>
              )}
            </ScrollArea>
          </section>
        </div>
      </StudentDialogShell>
    </TooltipProvider>
  );
}
