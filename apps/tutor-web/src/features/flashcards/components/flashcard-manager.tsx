'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  DataTableToolbar,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  ImageOcclusionEditor,
  ImageOcclusionViewer,
  Label,
  RichTextEditor,
  SearchableSelect,
  SegmentedControl,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
  type RichTextEditorRef,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import {
  Check,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Rows3,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  DataTableColumnDefinition,
  DataTableSortOption,
  DataTableState,
  Flashcard,
  FlashcardType,
  ImageOcclusionData,
  Tables,
} from '@altitutor/shared';
import { getClozeIndexes, getImageOcclusionGroupDescription, getImageOcclusionIndexes, parseClozeParts, renderClozeQuestionText, validateImageOcclusionData } from '@altitutor/shared';
import { UcatRowActions } from '@/features/ucat/shared/row-actions';
import { UcatSelectionToolbar } from '@/features/ucat/shared/selection-toolbar';
import { useTopics } from '@/features/topics/hooks';
import {
  tutorBtnIconOutline,
  tutorBtnOutline,
  tutorBtnPrimary,
  tutorDialogContentClass,
  tutorDialogFooterStrip,
  tutorDialogHeaderStrip,
  tutorTableBodyRow,
  tutorTableHeaderRow,
  tutorTableShell,
  tutorToolbarProps,
} from '@/shared/lib/tutor-visual';
import { cn } from '@/shared/utils';
import { useFlashcardMutations, useFlashcards } from '../hooks/useFlashcards';
import { useFlashcardImageUpload } from '../hooks/useFlashcardImageUpload';
import { flashcardsApi, type FlashcardMutationInput } from '../api/flashcards';

type Draft = {
  topicId: string;
  index: number;
  cardType: FlashcardType;
  clozeText: string;
  extra: string;
  imageFileId: string | null;
  imageAltText: string;
  imageUrl: string | null;
  imageFile: File | null;
  occlusionData: ImageOcclusionData | null;
};

type ImportResult = { inserted: number; rejected: Array<{ row: number; reason: string }> };

const defaultTableState: DataTableState = {
  search: '',
  filters: {},
  sortBy: 'index',
  sortDirection: 'asc',
  groupBy: null,
  page: 1,
  pageSize: 10,
  visibleColumns: ['index', 'preview', 'clozes', 'extra', 'actions'],
};

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'index', label: 'Index', sortable: true },
  { key: 'preview', label: 'Preview', sortable: true },
  { key: 'clozes', label: 'Clozes', sortable: true },
  { key: 'extra', label: 'Extra', sortable: true },
  { key: 'actions', label: 'Actions' },
];

const sortOptions: DataTableSortOption[] = [
  { key: 'index', label: 'Index' },
  { key: 'preview', label: 'Preview' },
  { key: 'clozes', label: 'Clozes' },
  { key: 'extra', label: 'Extra' },
];

const searchFromOptions = [
  { label: 'Text', value: 'text' },
  { label: 'Extra', value: 'extra' },
];

function htmlToText(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getNextAvailableClozeIndex(clozeText: string): number {
  const indexes = new Set(getClozeIndexes(clozeText));
  let index = 1;
  while (indexes.has(index)) index += 1;
  return index;
}

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

function Preview({ draft }: { draft: Draft }) {
  if (draft.cardType === 'image_occlusion') return <ImagePreview draft={draft} />;
  const { clozeText, extra } = draft;
  const clozeIndexes = useMemo(() => getClozeIndexes(clozeText), [clozeText]);
  const [showAnswer, setShowAnswer] = useState(false);

  if (clozeIndexes.length === 0) {
    return (
      <div className="rounded-xl bg-muted/45 p-6 text-sm text-muted-foreground ring-1 ring-black/[0.06] dark:ring-white/10">
        Add at least one cloze marker to preview the card.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          {clozeIndexes.length} cloze{clozeIndexes.length === 1 ? '' : 's'}
        </p>
        <Button type="button" variant="outline" size="sm" className={cn(tutorBtnOutline, 'gap-1.5')} onClick={() => setShowAnswer((value) => !value)}>
          {showAnswer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showAnswer ? 'Hide answer' : 'Show answer'}
        </Button>
      </div>

      <div className="space-y-3">
        {clozeIndexes.map((clozeIndex) => (
          <div key={clozeIndex} className="rounded-xl bg-background p-4 shadow-sm ring-1 ring-black/[0.06] dark:ring-white/10">
            <div className="mb-3 text-xs font-medium uppercase text-muted-foreground">Cloze {clozeIndex}</div>
            <div
              className="prose prose-sm max-w-none whitespace-pre-wrap text-lg leading-8 dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: clozePreviewHtml(clozeText, clozeIndex, showAnswer) }}
            />
            {showAnswer && extra ? (
              <div
                className="prose prose-sm mt-4 max-w-none rounded-xl bg-muted/35 p-3 dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: extra }}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ImagePreview({ draft }: { draft: Draft }) {
  const indexes = useMemo(() => getImageOcclusionIndexes(draft.occlusionData), [draft.occlusionData]);
  const [position, setPosition] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const activeIndex = indexes[Math.min(position, Math.max(0, indexes.length - 1))] ?? 1;
  if (!draft.imageUrl || !draft.occlusionData || indexes.length === 0) {
    return <div className="rounded-xl bg-muted/45 p-6 text-sm text-muted-foreground">Add an image and at least one box to preview the card.</div>;
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
      <ImageOcclusionViewer imageUrl={draft.imageUrl} alt={draft.imageAltText} data={draft.occlusionData} activeClozeIndex={activeIndex} showAnswer={showAnswer} />
      {showAnswer && getImageOcclusionGroupDescription(draft.occlusionData, activeIndex) ? <p className="rounded-xl bg-muted/35 p-3 text-sm">{getImageOcclusionGroupDescription(draft.occlusionData, activeIndex)}</p> : null}
      {showAnswer && draft.extra ? <div className="prose prose-sm max-w-none rounded-xl bg-muted/35 p-3 dark:prose-invert" dangerouslySetInnerHTML={{ __html: draft.extra }} /> : null}
    </div>
  );
}

function FlashcardDialog({
  open,
  topicId,
  card,
  cards,
  topics,
  isSaving,
  onOpenChange,
  onSave,
  onDelete,
}: {
  open: boolean;
  topicId: string;
  card: Flashcard | null;
  cards: Flashcard[];
  topics: Tables<'topics'>[];
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: FlashcardMutationInput) => Promise<void>;
  onDelete: (card: Flashcard) => void;
}) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [draft, setDraft] = useState<Draft>({ topicId, index: 1, cardType: 'text_cloze', clozeText: '', extra: '', imageFileId: null, imageAltText: '', imageUrl: null, imageFile: null, occlusionData: null });
  const [lastClozeIndex, setLastClozeIndex] = useState(1);
  const [, setEditorVersion] = useState(0);
  const clozeEditorRef = useRef<RichTextEditorRef>(null);
  const extraEditorRef = useRef<RichTextEditorRef>(null);
  const clozeImageUpload = useFlashcardImageUpload({ topicId: draft.topicId, editorRef: clozeEditorRef });
  const extraImageUpload = useFlashcardImageUpload({ topicId: draft.topicId, editorRef: extraEditorRef });

  useEffect(() => {
    if (!open) {
      setMode('edit');
      return;
    }
    const indexes = card?.card_type === 'text_cloze' ? getClozeIndexes(card.cloze_text ?? '') : [];
    setDraft({
      topicId: card?.topic_id ?? topicId,
      index: card?.index ?? cards.length + 1,
      cardType: card?.card_type ?? 'text_cloze',
      clozeText: card?.cloze_text ?? '',
      extra: card?.extra ?? '',
      imageFileId: card?.image_file_id ?? null,
      imageAltText: card?.image_alt_text ?? '',
      imageUrl: card?.image_url ?? null,
      imageFile: null,
      occlusionData: card?.occlusion_data ?? null,
    });
    setLastClozeIndex(indexes.at(-1) ?? 1);
    setEditorVersion((value) => value + 1);
  }, [card, cards.length, open, topicId]);

  const syncEditorHtml = useCallback(() => {
    const next = {
      clozeText: clozeEditorRef.current?.getEditor()?.getHTML() ?? draft.clozeText,
      extra: extraEditorRef.current?.getEditor()?.getHTML() ?? draft.extra,
    };
    setDraft((value) => ({ ...value, ...next }));
    return next;
  }, [draft.clozeText, draft.extra]);

  const getLiveClozeText = useCallback(() => clozeEditorRef.current?.getEditor()?.getHTML() ?? draft.clozeText, [draft.clozeText]);

  const insertCloze = useCallback((index: number) => {
    const editor = clozeEditorRef.current?.getEditor();
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to);
    const prefix = `{{c${index}::`;
    editor.chain().focus().insertContent(`${prefix}${selected}}}`).run();
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

  const hasClozeContent = (clozeEditorRef.current?.getEditor()?.getText() ?? draft.clozeText).trim().length > 0;
  const imageContentValid = draft.cardType === 'image_occlusion'
    && Boolean(draft.imageUrl)
    && validateImageOcclusionData(draft.occlusionData).length === 0;
  const canSave = draft.cardType === 'text_cloze' ? hasClozeContent : imageContentValid;
  const selectedTopic = topics.find((item) => item.id === draft.topicId) ?? null;

  const handleSave = async () => {
    const next = syncEditorHtml();
    if (draft.cardType === 'text_cloze') {
      await onSave({ topicId: draft.topicId, cardType: 'text_cloze', clozeText: next.clozeText, extra: next.extra, index: draft.index });
    } else {
      if (!draft.occlusionData) return;
      const upload = draft.imageFile ? await flashcardsApi.uploadImage(draft.topicId, draft.imageFile) : null;
      const imageFileId = upload?.fileId ?? draft.imageFileId;
      if (!imageFileId) return;
      const occlusionData = upload
        ? { ...draft.occlusionData, naturalWidth: upload.naturalWidth, naturalHeight: upload.naturalHeight }
        : draft.occlusionData;
      await onSave({ topicId: draft.topicId, cardType: 'image_occlusion', imageFileId, imageAltText: draft.imageAltText, occlusionData, extra: next.extra, index: draft.index });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(tutorDialogContentClass, 'flex h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 md:max-w-5xl [&>button]:hidden')}>
        <DialogHeader className={cn(tutorDialogHeaderStrip, 'flex-shrink-0 px-6 py-4')}>
          <div className="flex w-full items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Button type="button" variant="outline" size="icon" className={tutorBtnIconOutline} onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
              <DialogTitle>{card ? 'Edit Flashcard' : 'Add Flashcard'}</DialogTitle>
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
              {card ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="icon" className={tutorBtnIconOutline} aria-label="Flashcard actions">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="gap-2 text-destructive" onSelect={() => onDelete(card)}>
                      <Trash2 className="h-4 w-4" />
                      Delete flashcard
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden">
          {mode === 'preview' ? (
            <div className="h-full overflow-y-auto px-6 py-5">
              <Preview draft={draft} />
            </div>
          ) : (
            <div className="flex h-full min-h-0">
              <div className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="mx-auto grid max-w-5xl gap-5">
                  {!card ? (
                    <div className="space-y-2">
                      <Label>Card type</Label>
                      <SegmentedControl
                        value={draft.cardType}
                        onValueChange={(cardType) => setDraft((value) => ({ ...value, cardType }))}
                        options={[
                          { value: 'text_cloze', label: 'Text cloze' },
                          { value: 'image_occlusion', label: 'Image occlusion' },
                        ]}
                        aria-label="Flashcard type"
                      />
                    </div>
                  ) : null}
                  {draft.cardType === 'text_cloze' ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label>Body</Label>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" className={cn(tutorBtnOutline, 'gap-1.5')} onClick={insertNewCloze}>
                          <Plus className="h-4 w-4" />
                          New cloze
                        </Button>
                        <Button type="button" variant="outline" size="sm" className={tutorBtnOutline} onClick={insertSameCloze}>
                          Same cloze
                        </Button>
                      </div>
                    </div>
                    <div onDragOver={(event) => event.preventDefault()} onDrop={clozeImageUpload.handleDrop}>
                      <RichTextEditor
                        ref={clozeEditorRef}
                        content={draft.clozeText}
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
                      imageUrl={draft.imageUrl}
                      imageAltText={draft.imageAltText}
                      data={draft.occlusionData}
                      onChange={(occlusionData) => setDraft((value) => ({ ...value, occlusionData }))}
                      onImageAltTextChange={(imageAltText) => setDraft((value) => ({ ...value, imageAltText }))}
                      onImageSelected={(imageFile, dimensions) => {
                        const preserve = !draft.occlusionData?.masks.length
                          || window.confirm('Preserve the existing boxes on the replacement image? Select Cancel to clear them.');
                        if (draft.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(draft.imageUrl);
                        setDraft((value) => ({
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
                        content={draft.extra}
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

              <div className="hidden w-80 shrink-0 space-y-5 overflow-y-auto bg-muted/25 px-6 py-5 ring-1 ring-black/[0.06] md:block dark:ring-white/10">
                <div className="space-y-2">
                  <Label>Topic</Label>
                  <SearchableSelect<Tables<'topics'>>
                    items={topics}
                    value={selectedTopic}
                    onValueChange={(item) => {
                      if (!item) return;
                      setDraft((value) => ({ ...value, topicId: item.id }));
                    }}
                    getItemId={(item) => item.id}
                    getItemLabel={(item) => `${item.code ? `${item.code} ` : ''}${item.name}`}
                    getItemValue={(item) => `${item.code ?? ''} ${item.name ?? ''}`}
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
                    value={draft.index}
                    onChange={(event) => {
                      const nextIndex = Number(event.target.value);
                      setDraft((value) => ({
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

        <DialogFooter className={cn(tutorDialogFooterStrip, 'flex-shrink-0 px-6 py-4')}>
          <Button variant="outline" className={tutorBtnOutline} onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !canSave} className={cn(tutorBtnPrimary, 'gap-1.5')}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportFlashcardsDialog({
  open,
  isImporting,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  isImporting: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (csv: string) => Promise<ImportResult>;
}) {
  const [csv, setCsv] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCsv('');
      setMessage(null);
    }
  }, [open]);

  const handleImport = async () => {
    const result = await onImport(csv);
    setMessage(
      `Imported ${result.inserted} cards` +
        (result.rejected.length ? `; rejected ${result.rejected.length} rows` : ''),
    );
    if (result.inserted > 0) setCsv('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(tutorDialogContentClass, 'w-full gap-0 p-0 md:max-w-3xl [&>button]:hidden')}>
        <DialogHeader className={cn(tutorDialogHeaderStrip, 'px-6 py-4')}>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="icon" className={tutorBtnIconOutline} onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
            <div>
              <DialogTitle>Import Flashcards</DialogTitle>
              <DialogDescription>Paste CSV/TSV rows, including Anki cloze exports.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-3 px-6 py-5">
          <textarea
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            placeholder={'#separator:tab\n#html:true\n"{{c1::DNA}} stores genetic information"\t"Extra notes"\n\nOr paste CSV with headers:\ntext,order,extra'}
            className="min-h-[320px] w-full rounded-xl border-0 bg-background px-3 py-2 font-mono text-sm leading-6 shadow-sm outline-none ring-1 ring-black/[0.06] focus-visible:ring-2 focus-visible:ring-ring dark:ring-white/10"
          />
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </div>
        <DialogFooter className={cn(tutorDialogFooterStrip, 'px-6 py-4')}>
          <Button variant="outline" className={tutorBtnOutline} onClick={() => onOpenChange(false)} disabled={isImporting}>
            Close
          </Button>
          <Button onClick={handleImport} disabled={!csv.trim() || isImporting} className={cn(tutorBtnPrimary, 'gap-1.5')}>
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import CSV/TSV
          </Button>
          {message ? (
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="gap-1.5">
              <Check className="h-4 w-4" />
              Done
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function compareCards(a: Flashcard, b: Flashcard, sortBy: string | null, direction: 'asc' | 'desc') {
  const valueFor = (card: Flashcard): string | number => {
    switch (sortBy) {
      case 'preview':
        return htmlToText(renderClozeQuestionText(card.cloze_text, getClozeIndexes(card.cloze_text)[0] ?? 1));
      case 'clozes':
        return card.review_card_count ?? getClozeIndexes(card.cloze_text).length;
      case 'extra':
        return htmlToText(card.extra);
      case 'index':
      default:
        return card.index;
    }
  };
  const left = valueFor(a);
  const right = valueFor(b);
  const result = typeof left === 'number' && typeof right === 'number'
    ? left - right
    : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
  return direction === 'asc' ? result : -result;
}

function SortableFlashcardRow({
  cardId,
  className,
  children,
}: {
  cardId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cardId });

  return (
    <TableRow
      ref={setNodeRef}
      className={cn(className, isDragging && 'relative z-10 opacity-80')}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <TableCell className="w-10">
        <button
          type="button"
          className="cursor-grab rounded p-1 text-muted-foreground active:cursor-grabbing"
          aria-label="Drag flashcard"
          {...attributes}
          {...listeners}
          onClick={(event) => event.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      {children}
    </TableRow>
  );
}

export function FlashcardManager({ topicId }: { topicId: string }) {
  const { data: cards = [], isLoading, isFetching } = useFlashcards(topicId);
  const { data: topics = [] } = useTopics();
  const mutations = useFlashcardMutations(topicId);
  const [state, setState] = useState<DataTableState>(defaultTableState);
  const [searchFrom, setSearchFrom] = useState(['text', 'extra']);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [draftOrder, setDraftOrder] = useState<Flashcard[]>([]);

  const visibleColumns = useMemo(() => new Set(state.visibleColumns), [state.visibleColumns]);

  const filteredCards = useMemo(() => {
    const needle = state.search.trim().toLowerCase();
    const searched = needle
      ? cards.filter((card) =>
          [
            searchFrom.includes('text') ? card.cloze_text : null,
            searchFrom.includes('extra') ? card.extra : null,
          ]
            .filter((value) => value != null)
            .some((value) => htmlToText(value).toLowerCase().includes(needle)),
        )
      : cards;
    return [...searched].sort((a, b) => compareCards(a, b, state.sortBy, state.sortDirection));
  }, [cards, searchFrom, state.search, state.sortBy, state.sortDirection]);

  const displayCards = isReorderMode ? draftOrder : filteredCards;

  const paginatedCards = useMemo(() => {
    const start = (state.page - 1) * state.pageSize;
    return displayCards.slice(start, start + state.pageSize);
  }, [displayCards, state.page, state.pageSize]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(displayCards.length / state.pageSize));
    if (state.page > maxPage) {
      setState((value) => ({ ...value, page: maxPage }));
    }
  }, [displayCards.length, state.page, state.pageSize]);

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

  const openAdd = () => {
    setEditingCard(null);
    setDialogOpen(true);
  };

  const openEdit = (card: Flashcard) => {
    setEditingCard(card);
    setDialogOpen(true);
  };

  const startReorder = useCallback(() => {
    setDraftOrder([...cards].sort((a, b) => a.index - b.index));
    setIsReorderMode(true);
    setState((value) => ({ ...value, page: 1 }));
  }, [cards]);

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

  const isSaving = mutations.createCard.isPending || mutations.updateCard.isPending;
  const tableColumnCount = (
    (isReorderMode ? 1 : 0)
    + Number(visibleColumns.has('index'))
    + Number(visibleColumns.has('preview'))
    + Number(visibleColumns.has('clozes'))
    + Number(visibleColumns.has('extra'))
    + Number(!isReorderMode && visibleColumns.has('actions'))
  );

  return (
    <section className="space-y-4" aria-labelledby="flashcards-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="flashcards-heading" className="text-2xl font-semibold">
            Flashcards
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Cloze cards linked to this topic.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className={cn(tutorBtnOutline, 'gap-1.5')}>
                <MoreHorizontal className="h-4 w-4" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="gap-2" onSelect={startReorder}>
                <Rows3 className="h-4 w-4" />
                Reorder
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onSelect={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" />
                Import CSV/TSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={openAdd} className={cn(tutorBtnPrimary, 'gap-1.5')}>
            <Plus className="h-4 w-4" />
            Add Flashcard
          </Button>
        </div>
      </div>

      <DataTableToolbar
        state={state}
        onSearchChange={(search) => setState((value) => ({ ...value, search, page: 1 }))}
        onFiltersChange={(filters) => setState((value) => ({ ...value, filters, page: 1 }))}
        onSortChange={(sortBy, sortDirection) => setState((value) => ({ ...value, sortBy, sortDirection }))}
        onGroupByChange={(groupBy) => setState((value) => ({ ...value, groupBy }))}
        onVisibleColumnsChange={(visibleColumns) => setState((value) => ({ ...value, visibleColumns }))}
        onQuickFilterApply={() => undefined}
        onReset={() => {
          setState(defaultTableState);
          setSearchFrom(['text', 'extra']);
        }}
        columnDefinitions={columnDefinitions}
        sortOptions={sortOptions}
        searchFromOptions={searchFromOptions}
        searchFromValue={searchFrom}
        onSearchFromChange={(values) => setSearchFrom(values.length ? values : ['text', 'extra'])}
        searchPlaceholder="Search flashcards..."
        isLoading={isLoading}
        {...tutorToolbarProps}
      />

      <div className={tutorTableShell}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className={tutorTableHeaderRow}>
                {isReorderMode ? <TableHead className="w-10"><span className="sr-only">Reorder</span></TableHead> : null}
                {visibleColumns.has('index') ? <TableHead className="w-[84px]">Index</TableHead> : null}
                {visibleColumns.has('preview') ? <TableHead className="min-w-[340px]">Preview</TableHead> : null}
                {visibleColumns.has('clozes') ? <TableHead className="w-[100px]">Clozes</TableHead> : null}
                {visibleColumns.has('extra') ? <TableHead className="min-w-[220px]">Extra</TableHead> : null}
                {!isReorderMode && visibleColumns.has('actions') ? <TableHead className="w-[88px] text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            {isReorderMode ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={displayCards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={tableColumnCount} className="h-24 text-center text-muted-foreground">
                          Loading flashcards...
                        </TableCell>
                      </TableRow>
                    ) : paginatedCards.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={tableColumnCount} className="h-24 text-center text-muted-foreground">
                          No flashcards found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedCards.map((card) => {
                        const clozeIndexes = getClozeIndexes(card.cloze_text);
                        return (
                          <SortableFlashcardRow key={card.id} cardId={card.id} className={tutorTableBodyRow}>
                            {visibleColumns.has('index') ? <TableCell className="font-medium">{card.index}</TableCell> : null}
                            {visibleColumns.has('preview') ? (
                              <TableCell className="max-w-[520px]">
                                <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                                  {htmlToText(renderClozeQuestionText(card.cloze_text, clozeIndexes[0] ?? 1))}
                                </p>
                              </TableCell>
                            ) : null}
                            {visibleColumns.has('clozes') ? (
                              <TableCell>{card.review_card_count ?? clozeIndexes.length}</TableCell>
                            ) : null}
                            {visibleColumns.has('extra') ? (
                              <TableCell className="max-w-[320px]">
                                <p className="line-clamp-2 text-sm text-muted-foreground">{htmlToText(card.extra) || '—'}</p>
                              </TableCell>
                            ) : null}
                          </SortableFlashcardRow>
                        );
                      })
                    )}
                  </TableBody>
                </SortableContext>
              </DndContext>
            ) : (
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={tableColumnCount} className="h-24 text-center text-muted-foreground">
                      Loading flashcards...
                    </TableCell>
                  </TableRow>
                ) : paginatedCards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={tableColumnCount} className="h-24 text-center text-muted-foreground">
                      No flashcards found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCards.map((card) => {
                    const clozeIndexes = getClozeIndexes(card.cloze_text);
                    return (
                      <TableRow key={card.id} className={tutorTableBodyRow}>
                        {visibleColumns.has('index') ? <TableCell className="font-medium">{card.index}</TableCell> : null}
                        {visibleColumns.has('preview') ? (
                          <TableCell className="max-w-[520px]">
                            <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                              {htmlToText(renderClozeQuestionText(card.cloze_text, clozeIndexes[0] ?? 1))}
                            </p>
                          </TableCell>
                        ) : null}
                        {visibleColumns.has('clozes') ? (
                          <TableCell>{card.review_card_count ?? clozeIndexes.length}</TableCell>
                        ) : null}
                        {visibleColumns.has('extra') ? (
                          <TableCell className="max-w-[320px]">
                            <p className="line-clamp-2 text-sm text-muted-foreground">{htmlToText(card.extra) || '—'}</p>
                          </TableCell>
                        ) : null}
                        {visibleColumns.has('actions') ? (
                          <TableCell onClick={(event) => event.stopPropagation()}>
                            <div className="flex justify-end">
                              <UcatRowActions
                                actions={[
                                  {
                                    label: 'Edit',
                                    icon: <Pencil className="h-4 w-4" />,
                                    onClick: () => openEdit(card),
                                  },
                                  {
                                    label: 'Delete',
                                    icon: <Trash2 className="h-4 w-4" />,
                                    destructive: true,
                                    onClick: () => mutations.deleteCard.mutate(card.id),
                                  },
                                ]}
                              />
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            )}
          </Table>
        </div>
      </div>

      <TablePagination
        page={state.page}
        pageSize={state.pageSize}
        total={displayCards.length}
        isFetching={isFetching}
        onPageChange={(page) => setState((value) => ({ ...value, page }))}
        onPageSizeChange={(pageSize) => setState((value) => ({ ...value, pageSize, page: 1 }))}
      />

      <UcatSelectionToolbar
        selectedCount={isReorderMode ? draftOrder.length : 0}
        onCancel={cancelReorder}
        hideDelete
      >
        <span className="px-1 text-sm font-medium text-muted-foreground">Reorder flashcards</span>
        <Button type="button" size="sm" className={cn(tutorBtnPrimary, 'gap-1.5')} onClick={saveReorder} disabled={mutations.reorderCards.isPending}>
          {mutations.reorderCards.isPending ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save
        </Button>
      </UcatSelectionToolbar>

      <FlashcardDialog
        open={dialogOpen}
        topicId={topicId}
        card={editingCard}
        cards={cards}
        topics={topics as Tables<'topics'>[]}
        isSaving={isSaving}
        onOpenChange={setDialogOpen}
        onDelete={(card) => {
          mutations.deleteCard.mutate(card.id);
          setDialogOpen(false);
        }}
        onSave={async (draft) => {
          if (editingCard) {
            await mutations.updateCard.mutateAsync({
              cardId: editingCard.id,
              topicId: draft.topicId,
              clozeText: draft.clozeText,
              extra: draft.extra,
              index: draft.index,
            });
            return;
          }
          await mutations.createCard.mutateAsync({
            topicId: draft.topicId,
            clozeText: draft.clozeText,
            extra: draft.extra,
            index: draft.index,
          });
        }}
      />
      <ImportFlashcardsDialog
        open={importOpen}
        isImporting={mutations.importCsv.isPending}
        onOpenChange={setImportOpen}
        onImport={(csv) => mutations.importCsv.mutateAsync({ id: topicId, csv })}
      />
    </section>
  );
}
