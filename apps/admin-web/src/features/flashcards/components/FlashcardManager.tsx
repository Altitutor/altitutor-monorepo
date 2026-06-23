'use client';

import { useMemo, useState } from 'react';
import type { ColumnDef, Row } from '@tanstack/react-table';
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
import { MoreHorizontal, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import type { DataTableState, Flashcard } from '@altitutor/shared';
import { getClozeIndexes, renderClozeQuestionText } from '@altitutor/shared';
import { EditFlashcardDialog } from './EditFlashcardDialog';
import { ImportFlashcardsDialog } from './ImportFlashcardsDialog';
import { useFlashcardMutations, useFlashcards } from '../hooks/useFlashcards';

type FlashcardAction = {
  key: 'import';
  label: string;
  icon: typeof Upload;
};

const actionItems: FlashcardAction[] = [
  { key: 'import', label: 'Import CSV/TSV', icon: Upload },
];

function toPlainText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function FlashcardManager({ topicId }: { topicId: string }) {
  const { data: cards = [] } = useFlashcards(topicId);
  const mutations = useFlashcardMutations(topicId);
  const [search, setSearch] = useState('');
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(['preview', 'clozes', 'extra', 'actions']);

  const toolbarState: DataTableState = useMemo(
    () => ({
      search,
      filters: {},
      sortBy: null,
      sortDirection: 'asc',
      groupBy: null,
      visibleColumns,
      page: 1,
      pageSize: 10,
    }),
    [search, visibleColumns],
  );

  const filteredCards = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return cards;
    return cards.filter((card) =>
      [card.cloze_text, card.extra]
        .filter(Boolean)
        .some((value) => toPlainText(String(value)).toLowerCase().includes(needle)),
    );
  }, [cards, search]);

  const openAddDialog = () => {
    setEditingCard(null);
    setIsEditOpen(true);
  };

  const openEditDialog = (card: Flashcard) => {
    setEditingCard(card);
    setIsEditOpen(true);
  };

  type FlashcardRow = { row: Row<Flashcard> };

  const columns = useMemo<ColumnDef<Flashcard>[]>(
    () =>
      [
        visibleColumns.includes('preview')
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
        visibleColumns.includes('clozes')
          ? {
              id: 'clozes',
              header: 'Clozes',
              cell: ({ row }: FlashcardRow) => row.original.review_card_count ?? getClozeIndexes(row.original.cloze_text).length,
            }
          : null,
        visibleColumns.includes('extra')
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
        visibleColumns.includes('actions')
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
                      <DropdownMenuItem
                        className="gap-2 text-destructive"
                        onSelect={() => mutations.deleteCard.mutate(row.original.id)}
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
    [mutations.deleteCard, visibleColumns],
  );

  return (
    <section className="space-y-3" aria-labelledby="flashcards-heading">
      <div className="flex items-center justify-between gap-3">
        <h3 id="flashcards-heading" className="text-lg font-semibold">
          Flashcards
        </h3>
        <div className="flex items-center gap-2">
          <SearchableSelect<FlashcardAction>
            items={actionItems}
            value={null}
            onValueChange={(item) => {
              if (!item) return;
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
        state={toolbarState}
        onSearchChange={setSearch}
        onFiltersChange={() => {}}
        onSortChange={() => {}}
        onGroupByChange={() => {}}
        onVisibleColumnsChange={setVisibleColumns}
        onQuickFilterApply={() => {}}
        onReset={() => setSearch('')}
        columnDefinitions={[
          { key: 'preview', label: 'Preview' },
          { key: 'clozes', label: 'Clozes' },
          { key: 'extra', label: 'Extra' },
          { key: 'actions', label: 'Actions' },
        ]}
        searchPlaceholder="Search flashcards..."
      />

      <DataTable
        columns={columns}
        data={filteredCards}
        pageSizeOptions={[10, 20, 50]}
        onRowClick={openEditDialog}
      />

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
            });
            return;
          }
          await mutations.createCard.mutateAsync({
            topicId,
            clozeText: input.clozeText,
            extra: input.extra,
          });
        }}
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
