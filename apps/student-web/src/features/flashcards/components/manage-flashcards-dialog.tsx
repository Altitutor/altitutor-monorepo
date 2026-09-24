'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { StudentDialogShell } from '@/shared/components';
import { studentCardCn, studentTableBodyRow, studentTableHeaderRow } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';

export type FlashcardManageFilter = 'all' | FlashcardReviewCard['state'];

type HistoryRow = {
  id: string;
  review_card_id: string;
  action: string;
  rating: string | null;
  answered_at: string;
  duration_ms: number | null;
  pre_state: Record<string, unknown>;
  post_state: Record<string, unknown>;
  undone_at: string | null;
};

type FlashcardGroup = {
  id: string;
  cards: FlashcardReviewCard[];
  preview: string;
  states: FlashcardReviewCard['state'][];
  nextDueAt: string;
};

const defaultColumns = ['card', 'state', 'clozes', 'due'];

function createTableState(filter: FlashcardManageFilter): DataTableState {
  return {
    search: '',
    filters: filter === 'all' ? {} : { state: [filter] },
    sortBy: 'order',
    sortDirection: 'asc',
    groupBy: null,
    page: 1,
    pageSize: 100,
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

function stateBadgeVariant(state: FlashcardReviewCard['state']) {
  if (state === 'Review') return 'success' as const;
  if (state === 'Relearning') return 'destructive' as const;
  if (state === 'Learning') return 'default' as const;
  return 'secondary' as const;
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
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [tableState, setTableState] = useState<DataTableState>(() => createTableState(initialFilter));
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedReviewCardId, setSelectedReviewCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cardsResponse, historyResponse] = await Promise.all([
        fetch('/api/flashcards/review-cards?mode=all', { cache: 'no-store' }),
        fetch('/api/flashcards/review-cards/history', { cache: 'no-store' }),
      ]);
      if (!cardsResponse.ok || !historyResponse.ok) throw new Error('Unable to load flashcards');
      const [cardsResult, historyResult] = await Promise.all([cardsResponse.json(), historyResponse.json()]);
      setCards(cardsResult.data ?? []);
      setHistory(historyResult.data ?? []);
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
    const filtered = groups.filter((group) => {
      const searchable = [
        group.preview,
        ...group.cards.flatMap((card) => [card.topic_code ?? '', card.topic_name ?? '', card.subject_short_name ?? '']),
      ].join(' ').toLowerCase();
      if (search && !searchable.includes(search)) return false;
      if (selectedStates.length && !group.cards.some((card) => selectedStates.includes(card.state))) return false;
      if (selectedFlags.length && !group.cards.some((card) =>
        (selectedFlags.includes('suspended') && Boolean(card.suspended_at)) ||
        (selectedFlags.includes('buried') && Boolean(card.buried_until)) ||
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
  }, [groups, tableState]);

  useEffect(() => {
    if (filteredGroups.some((group) => group.id === selectedGroupId)) return;
    setSelectedGroupId(filteredGroups[0]?.id ?? null);
  }, [filteredGroups, selectedGroupId]);

  const selectedGroup = filteredGroups.find((group) => group.id === selectedGroupId) ?? null;

  useEffect(() => {
    if (selectedGroup?.cards.some((card) => card.id === selectedReviewCardId)) return;
    setSelectedReviewCardId(selectedGroup?.cards[0]?.id ?? null);
  }, [selectedGroup, selectedReviewCardId]);

  const activeCard = selectedGroup?.cards.find((card) => card.id === selectedReviewCardId) ?? selectedGroup?.cards[0] ?? null;
  const activeHistory = activeCard ? history.filter((row) => row.review_card_id === activeCard.id) : [];

  const command = async (card: FlashcardReviewCard, action: 'forget' | 'suspend' | 'resume' | 'bury' | 'unbury') => {
    if (action === 'forget' && !window.confirm('Reset this card to New? Its review history will be retained.')) return;
    setPendingCardId(card.id);
    setError(null);
    try {
      const response = await fetch(`/api/flashcards/review-cards/${encodeURIComponent(card.id)}/manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, requestId: crypto.randomUUID() }),
      });
      if (!response.ok) throw new Error('Command failed');
      await load();
    } catch (commandError) {
      console.error('Failed to manage flashcard:', commandError);
      setError('That change could not be saved. Please try again.');
    } finally {
      setPendingCardId(null);
    }
  };

  const unburyAll = async () => {
    const buriedCards = cards.filter((card) => card.buried_until);
    setPendingCardId('all');
    setError(null);
    try {
      const responses = await Promise.all(buriedCards.map((card) => fetch(`/api/flashcards/review-cards/${encodeURIComponent(card.id)}/manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unbury', requestId: crypto.randomUUID() }),
      })));
      if (responses.some((response) => !response.ok)) throw new Error('Unable to unbury every card');
      await load();
    } catch (commandError) {
      console.error('Failed to unbury flashcards:', commandError);
      setError('Some cards could not be unburied. Please try again.');
    } finally {
      setPendingCardId(null);
    }
  };

  const isColumnVisible = (column: string) => tableState.visibleColumns.includes(column);

  return (
    <StudentDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Manage flashcards"
      description="Search your cards, inspect each cloze, and manage its study state."
      contentClassName="h-[min(92vh,900px)]"
      headerActions={cards.some((card) => card.buried_until) ? (
        <Button variant="outline" size="sm" onClick={() => void unburyAll()} disabled={Boolean(pendingCardId)}>
          Unbury all
        </Button>
      ) : null}
    >
      <div className="grid h-full min-h-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="flex min-h-0 flex-col border-b border-border/60 lg:border-b-0 lg:border-r" aria-label="Flashcard list">
          <div className="shrink-0 space-y-3 border-b border-border/60 p-4">
            <DataTableToolbar
              state={tableState}
              onSearchChange={(search) => setTableState((current) => ({ ...current, search, page: 1 }))}
              onFiltersChange={(filters) => setTableState((current) => ({ ...current, filters, page: 1 }))}
              onSortChange={(sortBy, sortDirection) => setTableState((current) => ({ ...current, sortBy, sortDirection }))}
              onGroupByChange={() => undefined}
              onVisibleColumnsChange={(visibleColumns) => setTableState((current) => ({ ...current, visibleColumns }))}
              onQuickFilterApply={() => undefined}
              onReset={() => setTableState(createTableState('all'))}
              searchPlaceholder="Search flashcards…"
              filterDefinitions={[
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
              ]}
              defaultVisibleColumns={defaultColumns}
              compact
            />
            <p className="text-xs text-muted-foreground">{filteredGroups.length} of {groups.length} flashcards</p>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          </div>

          <ScrollArea className="min-h-[260px] flex-1">
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGroups.map((group) => (
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
                          <div className="flex flex-wrap gap-1">
                            {group.states.map((state) => <Badge key={state} variant={stateBadgeVariant(state)}>{state}</Badge>)}
                          </div>
                        </TableCell>
                      ) : null}
                      {isColumnVisible('clozes') ? <TableCell>{group.cards.length}</TableCell> : null}
                      {isColumnVisible('due') ? <TableCell className="text-xs text-muted-foreground">{formatDueDate(group.nextDueAt)}</TableCell> : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">No flashcards match these filters.</div>
            )}
          </ScrollArea>
        </section>

        <section className="min-h-0 bg-muted/15" aria-label="Selected flashcard details">
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
                      <Button size="sm" onClick={() => void command(activeCard, 'resume')} disabled={pendingCardId === activeCard.id}>Resume</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => void command(activeCard, 'suspend')} disabled={pendingCardId === activeCard.id}>Suspend</Button>
                    )}
                    {activeCard.buried_until ? (
                      <Button size="sm" onClick={() => void command(activeCard, 'unbury')} disabled={pendingCardId === activeCard.id}>Unbury</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => void command(activeCard, 'bury')} disabled={pendingCardId === activeCard.id}>Bury</Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => void command(activeCard, 'forget')} disabled={pendingCardId === activeCard.id}>Forget</Button>
                  </div>
                </div>

                <Tabs value={activeCard.id} onValueChange={setSelectedReviewCardId}>
                  <TabsList className="w-full justify-start">
                    {selectedGroup.cards.map((reviewCard) => (
                      <TabsTrigger key={reviewCard.id} value={reviewCard.id}>
                        Cloze {reviewCard.cloze_index}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {selectedGroup.cards.map((reviewCard) => (
                    <TabsContent key={reviewCard.id} value={reviewCard.id} className="mt-4 space-y-4">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant={stateBadgeVariant(reviewCard.state)}>{reviewCard.state}</Badge>
                        {reviewCard.suspended_at ? <Badge variant="outline">Suspended</Badge> : null}
                        {reviewCard.buried_until ? <Badge variant="outline">Buried</Badge> : null}
                        {reviewCard.leech_at ? <Badge variant="destructive">Leech suggested</Badge> : null}
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
  );
}
