'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef, Row } from '@tanstack/react-table';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DataTable,
  DataTableToolbar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SearchableSelect,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Check, ExternalLink, GripVertical, MoreHorizontal, Pencil, Plus, RotateCcw, Rows3, Trash2, Upload, X } from 'lucide-react';
import type { DataTableColumnDefinition, DataTableSortOption, Flashcard } from '@altitutor/shared';
import { getClozeIndexes, renderClozeQuestionText } from '@altitutor/shared';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { TablePagination } from '@/shared/components/TablePagination';
import { cn } from '@/shared/utils';
import { useTopics } from '@/features/topics/hooks';
import { EditFlashcardDialog } from './EditFlashcardDialog';
import { ImportFlashcardsDialog } from './ImportFlashcardsDialog';
import { useFlashcardMutations, useFlashcards } from '../hooks/useFlashcards';

type FlashcardAction = {
  key: 'open-page' | 'import' | 'reorder';
  label: string;
  icon: typeof Upload | typeof ExternalLink | typeof Rows3;
};

type FlashcardManagerProps = {
  topicId: string;
  title?: string;
  initialCardId?: string | null;
  onNavigateToPage?: (href: string) => void;
  showOpenInPage?: boolean;
};

const actionItems: FlashcardAction[] = [
  { key: 'open-page', label: 'Open in page', icon: ExternalLink },
  { key: 'reorder', label: 'Reorder', icon: Rows3 },
  { key: 'import', label: 'Import CSV/TSV', icon: Upload },
];

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'index', label: 'Index' },
  { key: 'preview', label: 'Preview' },
  { key: 'clozes', label: 'Clozes' },
  { key: 'extra', label: 'Extra' },
  { key: 'actions', label: 'Actions' },
];

const sortOptions: DataTableSortOption[] = [
  { key: 'index', label: 'Index' },
  { key: 'preview', label: 'Preview' },
  { key: 'clozes', label: 'Clozes' },
  { key: 'extra', label: 'Extra' },
];

const defaultSearchFrom = ['text', 'extra'];
const searchFromOptions = [
  { label: 'Text', value: 'text' },
  { label: 'Extra', value: 'extra' },
];

function toPlainText(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function getSortValue(card: Flashcard, sortBy: string | null): string | number {
  switch (sortBy) {
    case 'preview':
      return toPlainText(renderClozeQuestionText(card.cloze_text, getClozeIndexes(card.cloze_text)[0] ?? 1));
    case 'clozes':
      return card.review_card_count ?? getClozeIndexes(card.cloze_text).length;
    case 'extra':
      return toPlainText(card.extra);
    case 'index':
    default:
      return card.index;
  }
}

function SortableDragHandle({ cardId }: { cardId: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cardId });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn('cursor-grab rounded p-1 text-muted-foreground active:cursor-grabbing', isDragging && 'opacity-50')}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label="Drag flashcard"
      {...attributes}
      {...listeners}
      onClick={(event) => event.stopPropagation()}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

export function FlashcardManager({
  topicId,
  title = 'Flashcards',
  initialCardId = null,
  onNavigateToPage,
  showOpenInPage = true,
}: FlashcardManagerProps) {
  const router = useRouter();
  const { data: cards = [] } = useFlashcards(topicId);
  const { data: topics = [] } = useTopics();
  const mutations = useFlashcardMutations(topicId);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [handledInitialCardId, setHandledInitialCardId] = useState<string | null>(null);
  const [searchFrom, setSearchFrom] = useState(defaultSearchFrom);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [draftOrder, setDraftOrder] = useState<Flashcard[]>([]);
  const {
    state,
    setSearch,
    setSort,
    setFilters,
    setPage,
    setPageSize,
    setVisibleColumns,
    resetFilters,
  } = useDataTable({
    defaultSort: { field: 'index', direction: 'asc' },
    defaultVisibleColumns: ['index', 'preview', 'clozes', 'extra', 'actions'],
    pageSize: 10,
    skipUrlSync: true,
  });

  const filteredCards = useMemo(() => {
    const needle = state.search.trim().toLowerCase();
    const searchedCards = needle
      ? cards.filter((card) =>
          [
            searchFrom.includes('text') ? card.cloze_text : null,
            searchFrom.includes('extra') ? card.extra : null,
          ]
            .filter((value) => value != null)
            .some((value) => toPlainText(value).toLowerCase().includes(needle)),
        )
      : cards;

    return [...searchedCards].sort((a, b) => {
      const result = compareValues(getSortValue(a, state.sortBy), getSortValue(b, state.sortBy));
      return state.sortDirection === 'asc' ? result : -result;
    });
  }, [cards, searchFrom, state.search, state.sortBy, state.sortDirection]);

  const displayCards = isReorderMode ? draftOrder : filteredCards;

  const paginatedCards = useMemo(() => {
    const start = (state.page - 1) * state.pageSize;
    return displayCards.slice(start, start + state.pageSize);
  }, [displayCards, state.page, state.pageSize]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(displayCards.length / state.pageSize));
    if (state.page > maxPage) {
      setPage(maxPage);
    }
  }, [displayCards.length, setPage, state.page, state.pageSize]);

  useEffect(() => {
    if (!isReorderMode) return;
    setDraftOrder([...cards].sort((a, b) => a.index - b.index));
  }, [cards, isReorderMode]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (!initialCardId || handledInitialCardId === initialCardId) return;
    const card = cards.find((item) => item.id === initialCardId);
    if (!card) return;
    setEditingCard(card);
    setIsEditOpen(true);
    setHandledInitialCardId(initialCardId);
  }, [cards, handledInitialCardId, initialCardId]);

  useEffect(() => {
    setHandledInitialCardId(null);
  }, [initialCardId]);

  const openAddDialog = useCallback(() => {
    setEditingCard(null);
    setIsEditOpen(true);
  }, []);

  const openEditDialog = useCallback((card: Flashcard) => {
    setEditingCard(card);
    setIsEditOpen(true);
  }, []);

  const openCardPage = useCallback((card: Flashcard) => {
    const href = `/topics/${topicId}/flashcards?cardId=${encodeURIComponent(card.id)}`;
    setIsEditOpen(false);
    if (onNavigateToPage) {
      onNavigateToPage(href);
      return;
    }
    router.push(href);
  }, [onNavigateToPage, router, topicId]);

  const deleteCard = useCallback((card: Flashcard) => {
    mutations.deleteCard.mutate(card.id);
    if (editingCard?.id === card.id) {
      setIsEditOpen(false);
      setEditingCard(null);
    }
  }, [editingCard?.id, mutations.deleteCard]);

  const startReorder = useCallback(() => {
    setDraftOrder([...cards].sort((a, b) => a.index - b.index));
    setIsReorderMode(true);
    setPage(1);
  }, [cards, setPage]);

  const cancelReorder = useCallback(() => {
    setIsReorderMode(false);
    setDraftOrder([]);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setDraftOrder((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  }, []);

  const saveReorder = useCallback(async () => {
    await mutations.reorderCards.mutateAsync({
      id: topicId,
      cardIds: draftOrder.map((card) => card.id),
    });
    setIsReorderMode(false);
    setDraftOrder([]);
  }, [draftOrder, mutations.reorderCards, topicId]);

  type FlashcardRow = { row: Row<Flashcard> };

  const columns = useMemo<ColumnDef<Flashcard>[]>(
    () =>
      [
        isReorderMode
          ? {
              id: 'drag',
              header: () => <span className="sr-only">Reorder</span>,
              cell: ({ row }: FlashcardRow) => <SortableDragHandle cardId={row.original.id} />,
            }
          : null,
        state.visibleColumns.includes('index')
          ? {
              id: 'index',
              header: 'Index',
              cell: ({ row }: FlashcardRow) => (
                <span className="text-sm tabular-nums text-muted-foreground">{row.original.index}</span>
              ),
            }
          : null,
        state.visibleColumns.includes('preview')
          ? {
              id: 'preview',
              header: 'Preview',
              cell: ({ row }: FlashcardRow) => (
                <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {toPlainText(renderClozeQuestionText(row.original.cloze_text, getClozeIndexes(row.original.cloze_text)[0] ?? 1))}
                </p>
              ),
            }
          : null,
        state.visibleColumns.includes('clozes')
          ? {
              id: 'clozes',
              header: 'Clozes',
              cell: ({ row }: FlashcardRow) => row.original.review_card_count ?? getClozeIndexes(row.original.cloze_text).length,
            }
          : null,
        state.visibleColumns.includes('extra')
          ? {
              id: 'extra',
              header: 'Extra',
              cell: ({ row }: FlashcardRow) => (
                <span className="line-clamp-1 text-sm text-muted-foreground">
                  {toPlainText(row.original.extra) || 'None'}
                </span>
              ),
            }
          : null,
        !isReorderMode && state.visibleColumns.includes('actions')
          ? {
              id: 'actions',
              header: () => <span className="sr-only">Actions</span>,
              cell: ({ row }: FlashcardRow) => (
                <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" aria-label="Flashcard actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="gap-2" onSelect={() => openEditDialog(row.original)}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      {showOpenInPage ? (
                        <DropdownMenuItem className="gap-2" onSelect={() => openCardPage(row.original)}>
                          <ExternalLink className="h-4 w-4" />
                          Open in page
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem
                        className="gap-2 text-destructive"
                        onSelect={() => deleteCard(row.original)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ),
            }
          : null,
      ].filter(Boolean) as ColumnDef<Flashcard>[],
    [deleteCard, isReorderMode, openCardPage, openEditDialog, showOpenInPage, state.visibleColumns],
  );

  return (
    <section className="space-y-3" aria-labelledby="flashcards-heading">
      <div className="flex items-center justify-between gap-3">
        <h3 id="flashcards-heading" className="text-lg font-semibold">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          <SearchableSelect<FlashcardAction>
            items={actionItems.filter((item) => showOpenInPage || item.key !== 'open-page')}
            value={null}
            onValueChange={(item) => {
              if (!item) return;
              if (item.key === 'open-page') {
                const href = `/topics/${topicId}/flashcards`;
                if (onNavigateToPage) {
                  onNavigateToPage(href);
                  return;
                }
                router.push(href);
              }
              if (item.key === 'reorder') startReorder();
              if (item.key === 'import') setIsImportOpen(true);
            }}
            getItemId={(item) => item.key}
            getItemLabel={(item) => item.label}
            searchPlaceholder="Search actions..."
            emptyMessage="No actions found"
            showChevron={false}
            trigger={
              <Button variant="outline" size="icon" aria-label="Flashcard actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
            renderItem={(item) => {
              const Icon = item.icon;
              return (
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
              );
            }}
          />
          <Button size="sm" className="gap-1.5" onClick={openAddDialog}>
            <Plus className="h-4 w-4" />
            Add Flashcard
          </Button>
        </div>
      </div>

      <DataTableToolbar
        state={state}
        onSearchChange={setSearch}
        onFiltersChange={setFilters}
        onSortChange={setSort}
        onGroupByChange={() => {}}
        onVisibleColumnsChange={setVisibleColumns}
        onQuickFilterApply={() => {}}
        onReset={() => {
          resetFilters();
          setSearchFrom(defaultSearchFrom);
        }}
        sortOptions={sortOptions}
        columnDefinitions={columnDefinitions}
        searchFromOptions={searchFromOptions}
        searchFromValue={searchFrom}
        onSearchFromChange={setSearchFrom}
        searchPlaceholder="Search flashcards..."
      />

      {isReorderMode ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={displayCards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
            <DataTable
              columns={columns}
              data={paginatedCards}
              pageSizeOptions={[10, 20, 50]}
              pagination="external"
            />
          </SortableContext>
        </DndContext>
      ) : (
        <DataTable
          columns={columns}
          data={paginatedCards}
          pageSizeOptions={[10, 20, 50]}
          pagination="external"
          onRowClick={openEditDialog}
        />
      )}

      <TablePagination
        page={state.page}
        pageSize={state.pageSize}
        total={displayCards.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 20, 50]}
      />

      {isReorderMode ? (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-lg">
          <span className="px-2 text-sm text-muted-foreground">Reorder flashcards</span>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={cancelReorder}>
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button size="sm" className="gap-1.5" onClick={saveReorder} disabled={mutations.reorderCards.isPending}>
            {mutations.reorderCards.isPending ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save
          </Button>
        </div>
      ) : null}

      <EditFlashcardDialog
        open={isEditOpen}
        topicId={topicId}
        flashcard={editingCard}
        isSaving={mutations.createCard.isPending || mutations.updateCard.isPending}
        onOpenChange={setIsEditOpen}
        onSave={async (input) => {
          if (input.cardId) {
            await mutations.updateCard.mutateAsync({
              cardId: input.cardId,
              clozeText: input.clozeText,
              extra: input.extra,
              index: input.index,
              topicId: input.topicId,
            });
            return;
          }
          await mutations.createCard.mutateAsync({
            topicId: input.topicId,
            clozeText: input.clozeText,
            extra: input.extra,
            index: input.index,
          });
        }}
        onDelete={deleteCard}
        onOpenPage={showOpenInPage ? openCardPage : undefined}
        topics={topics}
      />

      <ImportFlashcardsDialog
        open={isImportOpen}
        isImporting={mutations.importCsv.isPending}
        onOpenChange={setIsImportOpen}
        onImport={(csv) => mutations.importCsv.mutateAsync({ id: topicId, csv })}
      />
    </section>
  );
}
