'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Label,
  ImageOcclusionEditor,
  ImageOcclusionViewer,
  SearchableSelect,
  SegmentedControl,
  RichTextEditor,
  type RichTextEditorRef,
} from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Check, ExternalLink, Eye, EyeOff, Loader2, MoreVertical, Plus, Trash2, X } from 'lucide-react';
import type { Flashcard, FlashcardType, ImageOcclusionData } from '@altitutor/shared';
import type { Tables } from '@altitutor/shared';
import { getClozeIndexes, getImageOcclusionGroupDescription, getImageOcclusionIndexes, parseClozeParts, validateImageOcclusionData } from '@altitutor/shared';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import { useFlashcardImageUpload } from '../hooks/useFlashcardImageUpload';
import { flashcardsApi, type FlashcardMutationInput } from '../api/flashcards';

type FormState = {
  cardType: FlashcardType;
  clozeText: string;
  extra: string;
  topicId: string;
  index: number;
  imageFileId: string | null;
  imageAltText: string;
  imageUrl: string | null;
  imageFile: File | null;
  occlusionData: ImageOcclusionData | null;
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

function Preview({ form }: { form: FormState }) {
  if (form.cardType === 'image_occlusion') return <ImagePreview form={form} />;
  const { clozeText, extra } = form;
  const clozeIndexes = useMemo(() => getClozeIndexes(clozeText), [clozeText]);
  const [showAnswer, setShowAnswer] = useState(false);

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
        <p className="text-sm font-medium text-muted-foreground">{clozeIndexes.length} cloze{clozeIndexes.length === 1 ? '' : 's'}</p>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAnswer((value) => !value)}>
          {showAnswer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showAnswer ? 'Hide answer' : 'Show answer'}
        </Button>
      </div>

      <div className="space-y-3">
        {clozeIndexes.map((clozeIndex) => (
          <div key={clozeIndex} className="rounded-lg border bg-background p-4">
            <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cloze {clozeIndex}
            </div>
            <div
              className="prose prose-sm max-w-none whitespace-pre-wrap text-lg leading-8 dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: clozePreviewHtml(clozeText, clozeIndex, showAnswer) }}
            />
            {showAnswer && extra ? (
              <div
                className="prose prose-sm mt-4 max-w-none rounded-md border bg-muted/30 p-3 dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: extra }}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ImagePreview({ form }: { form: FormState }) {
  const indexes = useMemo(() => getImageOcclusionIndexes(form.occlusionData), [form.occlusionData]);
  const [position, setPosition] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const activeIndex = indexes[Math.min(position, Math.max(0, indexes.length - 1))] ?? 1;
  if (!form.imageUrl || !form.occlusionData || indexes.length === 0) {
    return <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Add an image and at least one box to preview the card.</div>;
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">Cloze {activeIndex} · {position + 1} of {indexes.length}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={position === 0} onClick={() => { setPosition((value) => value - 1); setShowAnswer(false); }}>Previous</Button>
          <Button type="button" variant="outline" size="sm" disabled={position >= indexes.length - 1} onClick={() => { setPosition((value) => value + 1); setShowAnswer(false); }}>Next</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowAnswer((value) => !value)}>{showAnswer ? 'Hide answer' : 'Show answer'}</Button>
        </div>
      </div>
      <ImageOcclusionViewer imageUrl={form.imageUrl} alt={form.imageAltText} data={form.occlusionData} activeClozeIndex={activeIndex} showAnswer={showAnswer} />
      {showAnswer && getImageOcclusionGroupDescription(form.occlusionData, activeIndex) ? (
        <p className="rounded-lg border bg-muted/30 p-3 text-sm">{getImageOcclusionGroupDescription(form.occlusionData, activeIndex)}</p>
      ) : null}
      {showAnswer && form.extra ? <div className="prose prose-sm max-w-none rounded-lg border bg-muted/30 p-3 dark:prose-invert" dangerouslySetInnerHTML={{ __html: form.extra }} /> : null}
    </div>
  );
}

function getNextAvailableClozeIndex(clozeText: string): number {
  const indexes = new Set(getClozeIndexes(clozeText));
  let index = 1;
  while (indexes.has(index)) index += 1;
  return index;
}

export function EditFlashcardDialog({
  open,
  topicId,
  defaultIndex = 1,
  flashcard,
  isSaving,
  onOpenChange,
  onSave,
  onDelete,
  onOpenPage,
  topics,
}: {
  open: boolean;
  topicId: string;
  defaultIndex?: number;
  flashcard: Flashcard | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: FlashcardMutationInput & { cardId?: string }) => Promise<void>;
  onDelete?: (card: Flashcard) => void;
  onOpenPage?: (card: Flashcard) => void;
  topics: Tables<'topics'>[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [form, setForm] = useState<FormState>({ cardType: 'text_cloze', clozeText: '', extra: '', topicId, index: 1, imageFileId: null, imageAltText: '', imageUrl: null, imageFile: null, occlusionData: null });
  const [lastClozeIndex, setLastClozeIndex] = useState(1);
  const [, setEditorVersion] = useState(0);
  const clozeEditorRef = useRef<RichTextEditorRef>(null);
  const extraEditorRef = useRef<RichTextEditorRef>(null);
  const clozeImageUpload = useFlashcardImageUpload({ topicId, editorRef: clozeEditorRef });
  const extraImageUpload = useFlashcardImageUpload({ topicId, editorRef: extraEditorRef });

  useEffect(() => {
    if (!open) {
      setExpanded(false);
      setMode('edit');
      return;
    }
    const indexes = flashcard?.card_type === 'text_cloze' ? getClozeIndexes(flashcard.cloze_text ?? '') : [];
    setForm({
      cardType: flashcard?.card_type ?? 'text_cloze',
      clozeText: flashcard?.cloze_text ?? '',
      extra: flashcard?.extra ?? '',
      topicId: flashcard?.topic_id ?? topicId,
      index: flashcard?.index ?? defaultIndex,
      imageFileId: flashcard?.image_file_id ?? null,
      imageAltText: flashcard?.image_alt_text ?? '',
      imageUrl: flashcard?.image_url ?? null,
      imageFile: null,
      occlusionData: flashcard?.occlusion_data ?? null,
    });
    setEditorVersion((value) => value + 1);
    setLastClozeIndex(indexes.at(-1) ?? 1);
  }, [defaultIndex, flashcard, open, topicId]);

  const syncEditorHtml = useCallback(() => {
    const clozeHtml = clozeEditorRef.current?.getEditor()?.getHTML() ?? form.clozeText;
    const extraHtml = extraEditorRef.current?.getEditor()?.getHTML() ?? form.extra;
    setForm((value) => ({ ...value, clozeText: clozeHtml, extra: extraHtml }));
    return { clozeText: clozeHtml, extra: extraHtml };
  }, [form.clozeText, form.extra]);

  const hasClozeContent = (clozeEditorRef.current?.getEditor()?.getText() ?? form.clozeText).trim().length > 0;
  const imageContentValid = form.cardType === 'image_occlusion'
    && Boolean(form.imageUrl)
    && validateImageOcclusionData(form.occlusionData).length === 0;
  const canSave = form.cardType === 'text_cloze' ? hasClozeContent : imageContentValid;
  const getLiveClozeText = useCallback(() => clozeEditorRef.current?.getEditor()?.getHTML() ?? form.clozeText, [form.clozeText]);

  const insertCloze = useCallback((index: number) => {
    const editor = clozeEditorRef.current?.getEditor();
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to);
    const prefix = `{{c${index}::`;
    const replacement = `${prefix}${selected}}}`;
    editor.chain().focus().insertContent(replacement).run();
    const answerStart = from + prefix.length;
    editor.chain().focus().setTextSelection(selected ? { from: answerStart, to: answerStart + selected.length } : answerStart).run();
    setLastClozeIndex(index);
    requestAnimationFrame(syncEditorHtml);
  }, [syncEditorHtml]);

  const insertNewCloze = useCallback(() => {
    insertCloze(getNextAvailableClozeIndex(getLiveClozeText()));
  }, [getLiveClozeText, insertCloze]);

  const insertSameCloze = useCallback(() => {
    const liveText = getLiveClozeText();
    const indexes = getClozeIndexes(liveText);
    const index = indexes.includes(lastClozeIndex)
      ? lastClozeIndex
      : indexes.at(-1) ?? getNextAvailableClozeIndex(liveText);
    insertCloze(index);
  }, [getLiveClozeText, insertCloze, lastClozeIndex]);

  useEffect(() => {
    if (!open || mode !== 'edit') return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const commandKey = event.metaKey || event.ctrlKey;
      const isC = event.code === 'KeyC' || event.key.toLowerCase() === 'c';
      if (!commandKey || !event.shiftKey || !isC) return;
      event.preventDefault();
      if (event.altKey) {
        insertSameCloze();
        return;
      }
      insertNewCloze();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [insertNewCloze, insertSameCloze, mode, open]);

  const handleSave = async () => {
    const next = syncEditorHtml();
    if (form.cardType === 'text_cloze') {
      await onSave({ topicId: form.topicId, cardId: flashcard?.id, cardType: 'text_cloze', clozeText: next.clozeText, extra: next.extra, index: form.index });
    } else {
      if (!form.occlusionData) return;
      const upload = form.imageFile ? await flashcardsApi.uploadImage(form.topicId, form.imageFile) : null;
      const imageFileId = upload?.fileId ?? form.imageFileId;
      if (!imageFileId) return;
      const occlusionData = upload
        ? { ...form.occlusionData, naturalWidth: upload.naturalWidth, naturalHeight: upload.naturalHeight }
        : form.occlusionData;
      await onSave({ topicId: form.topicId, cardId: flashcard?.id, cardType: 'image_occlusion', imageFileId, imageAltText: form.imageAltText, occlusionData, extra: next.extra, index: form.index });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'w-full md:max-w-4xl h-[90vh] flex flex-col gap-0 p-0 overflow-hidden [&>button]:hidden',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS,
        )}
      >
        <DialogHeader className="flex-shrink-0 space-y-0 border-b px-6 py-4">
          <div className="flex w-full items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => onOpenChange(false)} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <DialogTitle>{flashcard ? 'Edit Flashcard' : 'Add Flashcard'}</DialogTitle>
                <DialogDescription className="sr-only">Create or edit a cloze flashcard.</DialogDescription>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <SegmentedControl
                value={mode}
                onValueChange={(value) => {
                  if (value === 'preview') syncEditorHtml();
                  setMode(value);
                }}
                options={[
                  { value: 'edit', label: 'Edit' },
                  { value: 'preview', label: 'Preview' },
                ]}
                size="sm"
                aria-label="Flashcard mode"
              />
              <ExpandButton expanded={expanded} onToggle={() => setExpanded((value) => !value)} />
              {flashcard && (onOpenPage || onDelete) ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="icon" aria-label="Flashcard actions">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onOpenPage ? (
                      <DropdownMenuItem className="gap-2" onSelect={() => onOpenPage(flashcard)}>
                        <ExternalLink className="h-4 w-4" />
                        Open in page
                      </DropdownMenuItem>
                    ) : null}
                    {onOpenPage && onDelete ? <DropdownMenuSeparator /> : null}
                    {onDelete ? (
                      <DropdownMenuItem className="gap-2 text-destructive" onSelect={() => onDelete(flashcard)}>
                        <Trash2 className="h-4 w-4" />
                        Delete flashcard
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden">
          {mode === 'preview' ? (
            <div className="h-full overflow-y-auto px-6 py-5">
              <Preview form={form} />
            </div>
          ) : (
            <div className="flex h-full min-h-0">
              <div className="flex-1 overflow-y-auto border-r px-6 py-5">
                <div className="mx-auto grid max-w-5xl gap-5">
                  {!flashcard ? (
                    <div className="space-y-2">
                      <Label>Card type</Label>
                      <SegmentedControl
                        value={form.cardType}
                        onValueChange={(cardType) => setForm((value) => ({ ...value, cardType }))}
                        options={[
                          { value: 'text_cloze', label: 'Text cloze' },
                          { value: 'image_occlusion', label: 'Image occlusion' },
                        ]}
                        aria-label="Flashcard type"
                      />
                    </div>
                  ) : null}
                  {form.cardType === 'text_cloze' ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label>Body</Label>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={insertNewCloze}>
                          <Plus className="h-4 w-4" />
                          New cloze
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={insertSameCloze}>
                          Same cloze
                        </Button>
                      </div>
                    </div>
                <div onDragOver={(event) => event.preventDefault()} onDrop={clozeImageUpload.handleDrop}>
                  <RichTextEditor
                    ref={clozeEditorRef}
                    content={form.clozeText}
                    onChange={() => setEditorVersion((value) => value + 1)}
                    onChangeDebounceMs={200}
                    placeholder="The {{c1::mitochondria}} is the powerhouse of the cell."
                    minHeight="280px"
                    pasteTableBehavior="keep"
                    onPasteImages={clozeImageUpload.handlePasteImages}
                  />
                </div>
              </div>
                  ) : (
                    <ImageOcclusionEditor
                      imageUrl={form.imageUrl}
                      imageAltText={form.imageAltText}
                      data={form.occlusionData}
                      onChange={(occlusionData) => setForm((value) => ({ ...value, occlusionData }))}
                      onImageAltTextChange={(imageAltText) => setForm((value) => ({ ...value, imageAltText }))}
                      onImageSelected={(imageFile, dimensions) => {
                        const preserve = !form.occlusionData?.masks.length
                          || window.confirm('Preserve the existing boxes on the replacement image? Select Cancel to clear them.');
                        if (form.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(form.imageUrl);
                        setForm((value) => ({
                          ...value,
                          imageFile,
                          imageFileId: null,
                          imageUrl: URL.createObjectURL(imageFile),
                          occlusionData: {
                            version: 1,
                            naturalWidth: dimensions.naturalWidth,
                            naturalHeight: dimensions.naturalHeight,
                            masks: preserve ? value.occlusionData?.masks ?? [] : [],
                            groupDescriptions: preserve ? value.occlusionData?.groupDescriptions : undefined,
                          },
                        }));
                      }}
                    />
                  )}

              <div className="space-y-2">
                <Label>Extra</Label>
                <div onDragOver={(event) => event.preventDefault()} onDrop={extraImageUpload.handleDrop}>
                  <RichTextEditor
                    ref={extraEditorRef}
                    content={form.extra}
                    onChange={() => setEditorVersion((value) => value + 1)}
                    onChangeDebounceMs={200}
                    placeholder="Optional answer-side context"
                    minHeight="140px"
                    pasteTableBehavior="keep"
                    onPasteImages={extraImageUpload.handlePasteImages}
                  />
                </div>
              </div>
                </div>
              </div>

              <div className="hidden w-80 flex-shrink-0 space-y-5 overflow-y-auto px-6 py-5 md:block">
                <div className="space-y-2">
                  <Label>Topic</Label>
                  <SearchableSelect<Tables<'topics'>>
                    items={topics}
                    value={topics.find((item) => item.id === form.topicId) ?? null}
                    onValueChange={(item) => {
                      if (!item) return;
                      setForm((value) => ({ ...value, topicId: item.id }));
                    }}
                    getItemId={(item) => item.id}
                    getItemLabel={(item) => `${item.code ? `${item.code} ` : ''}${item.name}`}
                    searchPlaceholder="Search topics..."
                    emptyMessage="No topics found"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flashcard-index">Index</Label>
                  <Input
                    id="flashcard-index"
                    type="number"
                    min={1}
                    value={form.index}
                    onChange={(event) => {
                      const nextIndex = Number(event.target.value);
                      setForm((value) => ({
                        ...value,
                        index: Number.isFinite(nextIndex) && nextIndex > 0 ? Math.trunc(nextIndex) : 1,
                      }));
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t bg-background px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !canSave} className="gap-1.5">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
