'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  RichTextEditor,
  type RichTextEditorRef,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Check, Eye, EyeOff, FilePenLine, Loader2, Plus, X } from 'lucide-react';
import type { Flashcard } from '@altitutor/shared';
import { getClozeIndexes, parseClozeParts } from '@altitutor/shared';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';

type FormState = {
  clozeText: string;
  extra: string;
};

function clozePreviewHtml(clozeText: string, clozeIndex: number, showAnswer: boolean): string {
  return parseClozeParts(clozeText, clozeIndex)
    .map((part) => {
      if (part.type === 'text') return part.text;
      if (!part.active) return part.answer;
      if (showAnswer) {
        return `<span class="rounded-md bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">${part.answer}</span>`;
      }
      return `<span class="rounded-md bg-muted px-2 py-1 font-semibold text-muted-foreground">${part.hint ? `... (${part.hint})` : '...'}</span>`;
    })
    .join('');
}

function Preview({ clozeText, extra }: { clozeText: string; extra: string }) {
  const clozeIndexes = useMemo(() => getClozeIndexes(clozeText), [clozeText]);
  const [activeCloze, setActiveCloze] = useState(clozeIndexes[0] ?? 1);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    if (!clozeIndexes.includes(activeCloze)) {
      setActiveCloze(clozeIndexes[0] ?? 1);
    }
  }, [activeCloze, clozeIndexes]);

  if (clozeIndexes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        Add at least one cloze marker to preview the card.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {clozeIndexes.map((clozeIndex) => (
            <Button
              key={clozeIndex}
              type="button"
              size="sm"
              variant={activeCloze === clozeIndex ? 'default' : 'outline'}
              onClick={() => {
                setActiveCloze(clozeIndex);
                setShowAnswer(false);
              }}
            >
              Cloze {clozeIndex}
            </Button>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAnswer((value) => !value)}>
          {showAnswer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showAnswer ? 'Hide answer' : 'Show answer'}
        </Button>
      </div>

      <div className="rounded-lg border bg-background p-4">
        <div
          className="prose prose-sm max-w-none whitespace-pre-wrap text-lg leading-8 dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: clozePreviewHtml(clozeText, activeCloze, showAnswer) }}
        />
        {showAnswer && extra ? (
          <div
            className="prose prose-sm mt-4 max-w-none rounded-md border bg-muted/30 p-3 dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: extra }}
          />
        ) : null}
      </div>
    </div>
  );
}

export function EditFlashcardDialog({
  open,
  topicId,
  flashcard,
  isSaving,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  topicId: string;
  flashcard: Flashcard | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: { topicId: string; cardId?: string; clozeText: string; extra?: string }) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [form, setForm] = useState<FormState>({ clozeText: '', extra: '' });
  const [lastClozeIndex, setLastClozeIndex] = useState(1);
  const [, setEditorVersion] = useState(0);
  const clozeEditorRef = useRef<RichTextEditorRef>(null);
  const extraEditorRef = useRef<RichTextEditorRef>(null);

  useEffect(() => {
    if (!open) {
      setExpanded(false);
      setMode('edit');
      return;
    }
    const indexes = flashcard ? getClozeIndexes(flashcard.cloze_text) : [];
    setForm({
      clozeText: flashcard?.cloze_text ?? '',
      extra: flashcard?.extra ?? '',
    });
    setEditorVersion((value) => value + 1);
    setLastClozeIndex(indexes.at(-1) ?? 1);
  }, [flashcard, open]);

  const nextClozeIndex = useMemo(() => {
    const indexes = getClozeIndexes(form.clozeText);
    return (indexes.at(-1) ?? 0) + 1;
  }, [form.clozeText]);

  const syncEditorHtml = useCallback(() => {
    const clozeHtml = clozeEditorRef.current?.getEditor()?.getHTML() ?? form.clozeText;
    const extraHtml = extraEditorRef.current?.getEditor()?.getHTML() ?? form.extra;
    setForm({ clozeText: clozeHtml, extra: extraHtml });
    return { clozeText: clozeHtml, extra: extraHtml };
  }, [form.clozeText, form.extra]);

  const hasClozeContent = (clozeEditorRef.current?.getEditor()?.getText() ?? form.clozeText).trim().length > 0;

  const insertCloze = useCallback((index: number) => {
    const editor = clozeEditorRef.current?.getEditor();
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to);
    const prefix = `{{c${index}::`;
    const replacement = `${prefix}${selected}}}`;
    editor.chain().focus().insertContent(replacement).run();
    if (!selected) {
      editor.chain().focus().setTextSelection(from + prefix.length).run();
    }
    setLastClozeIndex(index);
    requestAnimationFrame(syncEditorHtml);
  }, [syncEditorHtml]);

  useEffect(() => {
    if (!open || mode !== 'edit') return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const commandKey = event.metaKey || event.ctrlKey;
      if (!commandKey || !event.shiftKey || event.key.toLowerCase() !== 'c') return;
      event.preventDefault();
      insertCloze(event.altKey ? lastClozeIndex : nextClozeIndex);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [insertCloze, lastClozeIndex, mode, nextClozeIndex, open]);

  const handleSave = async () => {
    const next = syncEditorHtml();
    await onSave({
      topicId,
      cardId: flashcard?.id,
      clozeText: next.clozeText,
      extra: next.extra,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'w-full md:max-w-4xl h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS,
        )}
      >
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => onOpenChange(false)} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <DialogTitle>{flashcard ? 'Edit Flashcard' : 'Add Flashcard'}</DialogTitle>
                <DialogDescription className="sr-only">Create or edit a cloze flashcard.</DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="grid grid-cols-2 rounded-md border p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn('gap-1.5', mode === 'edit' && 'bg-muted')}
                  onClick={() => setMode('edit')}
                >
                  <FilePenLine className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn('gap-1.5', mode === 'preview' && 'bg-muted')}
                  onClick={() => {
                    syncEditorHtml();
                    setMode('preview');
                  }}
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </Button>
              </div>
              <ExpandButton expanded={expanded} onToggle={() => setExpanded((value) => !value)} />
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-muted/20 px-6 py-5">
          {mode === 'preview' ? (
            <Preview clozeText={form.clozeText} extra={form.extra} />
          ) : (
            <div className="mx-auto grid max-w-5xl gap-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Body</Label>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => insertCloze(nextClozeIndex)}>
                      <Plus className="h-4 w-4" />
                      New cloze
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => insertCloze(lastClozeIndex)}>
                      Same cloze
                    </Button>
                  </div>
                </div>
                <RichTextEditor
                  ref={clozeEditorRef}
                  content={form.clozeText}
                  onChange={() => setEditorVersion((value) => value + 1)}
                  onChangeDebounceMs={200}
                  placeholder="The {{c1::mitochondria}} is the powerhouse of the cell."
                  minHeight="280px"
                  pasteTableBehavior="keep"
                />
              </div>

              <div className="space-y-2">
                <Label>Extra</Label>
                <RichTextEditor
                  ref={extraEditorRef}
                  content={form.extra}
                  onChange={() => setEditorVersion((value) => value + 1)}
                  onChangeDebounceMs={200}
                  placeholder="Optional answer-side context"
                  minHeight="140px"
                  pasteTableBehavior="keep"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t bg-background px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasClozeContent} className="gap-1.5">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
