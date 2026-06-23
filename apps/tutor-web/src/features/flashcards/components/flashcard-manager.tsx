'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  RichTextEditor,
  type RichTextEditorRef,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Loader2, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import type { Flashcard } from '@altitutor/shared';
import { getClozeIndexes, renderClozeQuestionText } from '@altitutor/shared';
import { tutorCardCn } from '@/shared/lib/tutor-visual';
import { useFlashcardMutations, useFlashcards } from '../hooks/useFlashcards';

type Draft = {
  clozeText: string;
  extra: string;
};

function FlashcardDialog({
  open,
  card,
  isSaving,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  card: Flashcard | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: Draft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>({ clozeText: '', extra: '' });
  const clozeEditorRef = useRef<RichTextEditorRef>(null);
  const extraEditorRef = useRef<RichTextEditorRef>(null);

  useEffect(() => {
    if (!open) return;
    setDraft({
      clozeText: card?.cloze_text ?? '',
      extra: card?.extra ?? '',
    });
  }, [card, open]);

  const syncEditorHtml = () => {
    const next = {
      clozeText: clozeEditorRef.current?.getEditor()?.getHTML() ?? draft.clozeText,
      extra: extraEditorRef.current?.getEditor()?.getHTML() ?? draft.extra,
    };
    setDraft(next);
    return next;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full md:max-w-3xl p-0 gap-0 [&>button]:hidden">
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
            <DialogTitle>{card ? 'Edit Flashcard' : 'Add Flashcard'}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <RichTextEditor
            ref={clozeEditorRef}
            content={draft.clozeText}
            onChange={() => requestAnimationFrame(syncEditorHtml)}
            placeholder="The {{c1::mitochondria}} is the powerhouse of the cell."
            minHeight="260px"
            pasteTableBehavior="keep"
          />
          <RichTextEditor
            ref={extraEditorRef}
            content={draft.extra}
            onChange={() => requestAnimationFrame(syncEditorHtml)}
            placeholder="Optional answer-side context"
            minHeight="140px"
            pasteTableBehavior="keep"
          />
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await onSave(syncEditorHtml());
              onOpenChange(false);
            }}
            disabled={isSaving || !draft.clozeText.trim()}
            className="gap-1.5"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FlashcardManager({ topicId }: { topicId: string }) {
  const { data: cards = [], isLoading } = useFlashcards(topicId);
  const mutations = useFlashcardMutations(topicId);
  const [query, setQuery] = useState('');
  const [csv, setCsv] = useState('');
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredCards = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return cards;
    return cards.filter((card) =>
      [card.cloze_text, card.extra]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [cards, query]);

  const openAdd = () => {
    setEditingCard(null);
    setDialogOpen(true);
  };

  return (
    <section className={tutorCardCn('space-y-4 p-5 sm:p-6')} aria-labelledby="flashcards-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="flashcards-heading" className="text-2xl font-semibold">
            Flashcards
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Cloze-only cards linked to this topic.</p>
        </div>
        <Button onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Flashcard
        </Button>
      </div>

      <div className="rounded-lg border">
        <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search flashcards..."
              className="h-9 pl-8"
            />
          </div>
          <div className="flex gap-2">
            <Input
              value={csv}
              onChange={(event) => setCsv(event.target.value)}
              placeholder="Paste CSV/TSV then import"
              className="h-9 min-w-[240px]"
            />
            <Button
              variant="outline"
              className="gap-1.5"
              disabled={!csv.trim() || mutations.importCsv.isPending}
              onClick={async () => {
                await mutations.importCsv.mutateAsync({ id: topicId, csv });
                setCsv('');
              }}
            >
              <Upload className="h-4 w-4" />
              Import
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[360px]">Preview</TableHead>
                <TableHead className="w-[100px]">Clozes</TableHead>
                <TableHead className="w-[88px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    Loading flashcards...
                  </TableCell>
                </TableRow>
              ) : filteredCards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    No flashcards yet.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCards.map((card) => (
                  <TableRow
                    key={card.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setEditingCard(card);
                      setDialogOpen(true);
                    }}
                  >
                    <TableCell className="max-w-[520px]">
                      <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {renderClozeQuestionText(card.cloze_text, getClozeIndexes(card.cloze_text)[0] ?? 1)}
                      </p>
                    </TableCell>
                    <TableCell>{card.review_card_count ?? getClozeIndexes(card.cloze_text).length}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingCard(card);
                            setDialogOpen(true);
                          }}
                          aria-label="Edit flashcard"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={(event) => {
                            event.stopPropagation();
                            mutations.deleteCard.mutate(card.id);
                          }}
                          aria-label="Delete flashcard"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <FlashcardDialog
        open={dialogOpen}
        card={editingCard}
        isSaving={mutations.createCard.isPending || mutations.updateCard.isPending}
        onOpenChange={setDialogOpen}
        onSave={async (draft) => {
          if (editingCard) {
            await mutations.updateCard.mutateAsync({
              cardId: editingCard.id,
              clozeText: draft.clozeText,
              extra: draft.extra,
            });
            return;
          }
          await mutations.createCard.mutateAsync({
            topicId,
            clozeText: draft.clozeText,
            extra: draft.extra,
          });
        }}
      />
    </section>
  );
}
