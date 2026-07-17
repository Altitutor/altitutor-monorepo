'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  Button,
  SegmentedControl,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  useToast,
  type JSONContent,
  type MentionClickDetail,
} from '@altitutor/ui';
import { MoreVertical, ExternalLink, Trash2, X, Loader2, Check, CloudOff } from 'lucide-react';
import { RichTextTemplateMenuItems } from '@/features/rich-text-templates/components/RichTextTemplateMenuItems';
import { SaveAsTemplateDialog } from '@/features/rich-text-templates/components/SaveAsTemplateDialog';
import type { Editor } from '@tiptap/react';
import { useNote, useFolders } from '../api/queries';
import { useDeleteNote, useUpdateNote } from '../hooks/useNoteMutations';
import {
  getDocumentEditLockOwnerName,
  isDocumentEditLockActive,
  useDocumentEditLock,
} from '../hooks/useDocumentEditLock';
import { NoteAutoSaveBridge } from '../hooks/useNoteAutoSave';
import { DOCUMENT_NOTE_MENTION_TYPES } from '../constants/documentEditorMentions';
import { NoteEditor, type NoteEditorRef } from './NoteEditor';
import { NoteEditorBottomToolbar } from './NoteEditorBottomToolbar';
import { NoteDocumentSidebarPanel } from './NoteDocumentSidebarPanel';
import { NotePropertyPills } from './NotePropertyPills';
import type { NoteFormData, NoteUpdate } from '../types';
import type { Resolver } from 'react-hook-form';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import { DOCUMENT_TITLE_FIELD_CLASS } from '../constants/documentTitle';
import { useFitDocumentTitle } from '../hooks/useFitDocumentTitle';
import { useMentionSuggestions } from '@/shared/hooks/useMentionSuggestions';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.any(),
  folder_id: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
  is_tutor_documentation: z.boolean().optional(),
});

type DocumentMode = 'view' | 'edit';

interface EditDocumentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string | null;
  /** When 'edit', acquire the edit lock and enter edit mode once the editor is ready. */
  initialMode?: DocumentMode;
}

export function EditDocumentDialog({
  isOpen,
  onClose,
  noteId,
  initialMode = 'view',
}: EditDocumentDialogProps) {
  const router = useRouter();
  const noteEditorRef = useRef<NoteEditorRef>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const lastResetNoteIdRef = useRef<string | null>(null);
  const lastAppliedServerValuesRef = useRef<NoteFormData | null>(null);
  const lastAppliedServerUpdatedAtRef = useRef<string | null>(null);
  const lastLocalContentEditAtRef = useRef(0);
  const suppressLocalContentEditsUntilRef = useRef(0);
  const isUpdatingFromServerRef = useRef(false);
  const lastTakeoverLockTokenRef = useRef<string | null>(null);
  const didAutoEnterEditRef = useRef<string | null>(null);
  const editModePromptClicksRef = useRef(0);
  const lastEditModePromptAtRef = useRef(0);
  const editModeToastVisibleRef = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [acceptedServerVersion, setAcceptedServerVersion] = useState<string>('');
  const [mode, setMode] = useState<DocumentMode>('view');
  const [expanded, setExpanded] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isTakeoverDialogOpen, setIsTakeoverDialogOpen] = useState(false);
  const [linkedDocumentId, setLinkedDocumentId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setExpanded(false);
      setLinkedDocumentId(null);
      didAutoEnterEditRef.current = null;
      editModePromptClicksRef.current = 0;
      lastEditModePromptAtRef.current = 0;
      editModeToastVisibleRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    setLinkedDocumentId(null);
    setMode('view');
    didAutoEnterEditRef.current = null;
    editModePromptClicksRef.current = 0;
    lastEditModePromptAtRef.current = 0;
    editModeToastVisibleRef.current = false;
  }, [noteId]);

  /** Until reset runs, RHF can still hold the previous note — never paint that into the editor. */
  useLayoutEffect(() => {
    setIsInitialized(false);
  }, [noteId]);

  const handleEditorReady = useCallback((editor: Editor) => {
    setEditorInstance(editor);
  }, []);
  const { data: note, isLoading } = useNote(noteId || '', !!noteId && isOpen);
  const { data: folders } = useFolders();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const editLock = useDocumentEditLock(noteId, !!noteId && isOpen);
  const isEditing = mode === 'edit' && editLock.isHeldByThisWindow;

  useEffect(() => {
    if (mode === 'edit' && editLock.isHeldByAnotherWindow) {
      const takeoverLockToken = editLock.lock?.lock_token ?? null;
      if (takeoverLockToken && takeoverLockToken !== lastTakeoverLockTokenRef.current) {
        lastTakeoverLockTokenRef.current = takeoverLockToken;
        toast({
          title: 'Edit mode ended',
          description: `${getDocumentEditLockOwnerName(editLock.lock)} is now editing this document.`,
        });
      }
      setMode('view');
    }
  }, [editLock.isHeldByAnotherWindow, editLock.lock, mode, toast]);

  useEffect(() => {
    if (!isOpen && mode === 'edit') {
      setMode('view');
      void editLock.release();
    }
  }, [editLock, isOpen, mode]);

  const form = useForm<NoteFormData>({
    resolver: zodResolver(formSchema) as Resolver<NoteFormData>,
    defaultValues: {
      title: '',
      content: '',
      folder_id: null,
      project_id: null,
      is_tutor_documentation: false,
    },
  });

  const mentionSuggestions = useMentionSuggestions({
    types: DOCUMENT_NOTE_MENTION_TYPES,
    excludeIds: noteId ? [noteId] : [],
  });

  const handleDocumentMentionClick = useCallback(
    (detail: MentionClickDetail) => {
      if (!noteId) return false;
      if (detail.type === 'note' && detail.id !== noteId) {
        setLinkedDocumentId(detail.id);
        return true;
      }
      return false;
    },
    [noteId]
  );

  useLayoutEffect(() => {
    if (
      !note ||
      !isOpen ||
      isLoading ||
      note.id !== noteId
    ) {
      return;
    }
    const nextValues: NoteFormData = {
      title: note.title,
      content: (note.content as JSONContent) || '',
      folder_id: note.folder_id,
      project_id: (note as { project_id?: string | null }).project_id ?? null,
      is_tutor_documentation: Boolean(note.is_tutor_documentation),
    };
    const isInitialLoad = note.id !== lastResetNoteIdRef.current;
    const hasServerChange = note.updated_at !== lastAppliedServerUpdatedAtRef.current;
    const hasRecentLocalContentEdit = Date.now() - lastLocalContentEditAtRef.current < 5000;

    if (!isInitialLoad && (!hasServerChange || hasRecentLocalContentEdit || updateNote.isPending)) {
      const currentValues = form.getValues();
      if (hasServerChange && hasRecentLocalContentEdit && !updateNote.isPending && !isEditing) {
        const mergedValues: NoteFormData = {
          ...currentValues,
          title: nextValues.title,
          folder_id: nextValues.folder_id,
          project_id: nextValues.project_id,
          is_tutor_documentation: nextValues.is_tutor_documentation,
        };
        isUpdatingFromServerRef.current = true;
        form.reset(mergedValues);
        lastAppliedServerValuesRef.current = mergedValues;
        lastAppliedServerUpdatedAtRef.current = note.updated_at;
        queueMicrotask(() => {
          isUpdatingFromServerRef.current = false;
        });
        return;
      }
      if (JSON.stringify(currentValues) === JSON.stringify(nextValues)) {
        lastAppliedServerValuesRef.current = nextValues;
        lastAppliedServerUpdatedAtRef.current = note.updated_at;
      }
      return;
    }

    setEditorInstance(null);
    isUpdatingFromServerRef.current = true;
    form.reset(nextValues);
    lastResetNoteIdRef.current = note.id;
    lastAppliedServerValuesRef.current = nextValues;
    lastAppliedServerUpdatedAtRef.current = note.updated_at;
    suppressLocalContentEditsUntilRef.current = Date.now() + 1000;
    setAcceptedServerVersion(note.updated_at);
    setIsInitialized(true);
    queueMicrotask(() => {
      isUpdatingFromServerRef.current = false;
    });
  }, [note, isOpen, isLoading, noteId, form, updateNote.isPending, isEditing]);

  useEffect(() => {
    if (!isOpen) {
      lastResetNoteIdRef.current = null;
      lastAppliedServerValuesRef.current = null;
      lastAppliedServerUpdatedAtRef.current = null;
      lastLocalContentEditAtRef.current = 0;
      suppressLocalContentEditsUntilRef.current = 0;
      setIsInitialized(false);
      setEditorInstance(null);
      setAcceptedServerVersion('');
    }
  }, [isOpen]);

  const handleAutoSave = useCallback(
    (updates: Partial<NoteFormData>) => {
      if (!noteId) return;
      updateNote.mutate({
        id: noteId,
        updates: updates as NoteUpdate,
        silent: true,
      });
    },
    [noteId, updateNote]
  );

  const handleContentChange = useCallback(
    (onChange: (value: JSONContent) => void) => (value: JSONContent) => {
      if (
        !isUpdatingFromServerRef.current &&
        Date.now() > suppressLocalContentEditsUntilRef.current
      ) {
        lastLocalContentEditAtRef.current = Date.now();
      }
      onChange(value);
    },
    []
  );

  const handleDelete = useCallback(async () => {
    if (!noteId) return;
    await deleteNote.mutateAsync(noteId);
    onClose();
  }, [noteId, deleteNote, onClose]);

  const enterEditMode = useCallback(async () => {
    await editLock.acquire();
    setMode('edit');
  }, [editLock]);

  useEffect(() => {
    if (!isOpen || !noteId || initialMode !== 'edit') return;
    if (didAutoEnterEditRef.current === noteId) return;
    if (isLoading || !note || note.id !== noteId || !isInitialized) return;
    if (lastResetNoteIdRef.current !== noteId) return;

    didAutoEnterEditRef.current = noteId;
    void enterEditMode();
  }, [
    enterEditMode,
    initialMode,
    isInitialized,
    isLoading,
    isOpen,
    note,
    noteId,
  ]);

  const handleModeChange = useCallback(
    async (nextMode: DocumentMode) => {
      if (nextMode === mode) return;

      if (nextMode === 'view') {
        setMode('view');
        await editLock.release();
        return;
      }

      const latestLock = (await editLock.refetch()).data ?? null;
      if (
        latestLock &&
        isDocumentEditLockActive(latestLock) &&
        latestLock.lock_token !== editLock.lockToken
      ) {
        setIsTakeoverDialogOpen(true);
        return;
      }

      await enterEditMode();
    },
    [editLock, enterEditMode, mode]
  );

  const handleTakeover = useCallback(async () => {
    await enterEditMode();
    setIsTakeoverDialogOpen(false);
  }, [enterEditMode]);

  const showEditModeToast = useCallback(() => {
    if (isEditing) return;
    const now = Date.now();
    // Coalesce pointerdown + focus from the same gesture into one click
    if (now - lastEditModePromptAtRef.current < 75) return;
    lastEditModePromptAtRef.current = now;
    editModePromptClicksRef.current += 1;
    if (editModePromptClicksRef.current < 2) return;
    if (editModeToastVisibleRef.current) return;
    editModeToastVisibleRef.current = true;
    toast({
      id: 'document-edit-mode-prompt',
      title: 'Switch to edit mode?',
      description: 'This document is currently open in view mode.',
      action: { label: 'Edit', onClick: () => void handleModeChange('edit') },
      onDismiss: () => {
        editModeToastVisibleRef.current = false;
      },
    });
  }, [handleModeChange, isEditing, toast]);

  const titleText = form.watch('title');
  useFitDocumentTitle(titleInputRef, titleText);

  if (!noteId || !isOpen) return null;

  const editorReady =
    !isLoading && !!note && note.id === noteId && isInitialized && lastResetNoteIdRef.current === noteId;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'w-full md:max-w-4xl h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3 flex-1">
              <Button variant="outline" size="icon" onClick={onClose} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
              <DialogTitle>{!editorReady ? 'Loading...' : 'Edit Document'}</DialogTitle>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium pr-2 mr-2">
                {isEditing && updateNote.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : updateNote.isError ? (
                  <>
                    <CloudOff className="h-3 w-3 text-destructive" />
                    <span className="text-destructive">Changes not saved</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span>Saved</span>
                  </>
                )}
              </div>
              <SegmentedControl<DocumentMode>
                value={mode}
                onValueChange={(value) => void handleModeChange(value)}
                size="sm"
                aria-label="Document mode"
                options={[
                  { value: 'view', label: 'View' },
                  { value: 'edit', label: 'Edit' },
                ]}
              />
              <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => router.push(`/documents/${noteId}`)}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in page
                  </DropdownMenuItem>
                  <RichTextTemplateMenuItems
                    getEditor={() => noteEditorRef.current?.getEditor() ?? null}
                    getCurrentContent={() => form.getValues('content') ?? null}
                    onSaveAsTemplateClick={() => setIsSaveDialogOpen(true)}
                  />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDelete} className="!text-destructive focus:!text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </DialogHeader>

        {!editorReady ? (
          <div className="p-6">Loading document...</div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <Form {...form}>
              <form className="flex h-full min-w-0">
                <NoteAutoSaveBridge
                  form={form}
                  noteId={noteId}
                  note={note ?? undefined}
                  isInitialized={isInitialized && isEditing}
                  isUpdatingFromServer={() => isUpdatingFromServerRef.current}
                  onSave={handleAutoSave}
                />

                <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r">
                  {/*
                    Native vertical scroll instead of ScrollArea: Radix ScrollArea uses
                    overflow-x: hidden on the viewport, which clips the heading fold gutter
                    (negative margin on .tiptap-heading-block).
                  */}
                  <div className="max-h-full min-h-0 min-w-0 flex-1 overflow-y-auto">
                    {/*
                      Left padding ≥ gutter outdent (2.75rem) so the fold control stays inside
                      the scroll paint bounds even when overflow-x computes to auto.
                    */}
                    <div
                      className="mx-auto max-w-3xl space-y-4 pb-6 pl-[2.75rem] pr-6 pt-6"
                      onPointerDownCapture={() => {
                        if (!isEditing) showEditModeToast();
                      }}
                    >
                      <div className="md:hidden">
                        <NotePropertyPills form={form} folders={folders || []} editable={isEditing} />
                      </div>

                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <input
                                ref={titleInputRef}
                                value={field.value || ''}
                                onChange={field.onChange}
                                readOnly={!isEditing}
                                onFocus={() => {
                                  if (!isEditing) showEditModeToast();
                                }}
                                placeholder="Untitled"
                                className={cn(
                                  'w-full bg-transparent outline-none border-none',
                                  DOCUMENT_TITLE_FIELD_CLASS,
                                )}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <NoteEditor
                                key={`${noteId}-${acceptedServerVersion}`}
                                ref={noteEditorRef}
                                content={field.value}
                                onChange={handleContentChange(field.onChange)}
                                editable={isEditing}
                                placeholder="Start writing..."
                                enableCollapsibleHeadings
                                onEditorReady={handleEditorReady}
                                mentionSuggestions={mentionSuggestions}
                                onMentionClick={handleDocumentMentionClick}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="flex-shrink-0 px-4 pb-4 pt-2">
                      <NoteEditorBottomToolbar editor={editorInstance} />
                    </div>
                  ) : null}
                </div>

                <div className="hidden md:flex w-80 min-w-[320px] flex-col overflow-hidden border-l">
                  <NoteDocumentSidebarPanel
                    form={form}
                    folders={folders || []}
                    editable={isEditing}
                    editor={editorInstance}
                    onViewModeInteract={() => {
                      if (!isEditing) showEditModeToast();
                    }}
                  />
                </div>
              </form>
            </Form>
          </div>
        )}
      </DialogContent>
      <SaveAsTemplateDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        initialContent={form.getValues('content') ?? null}
        onSuccess={() => setIsSaveDialogOpen(false)}
      />
    </Dialog>

      {linkedDocumentId ? (
        <EditDocumentDialog
          isOpen
          noteId={linkedDocumentId}
          onClose={() => setLinkedDocumentId(null)}
        />
      ) : null}
      <AlertDialog open={isTakeoverDialogOpen} onOpenChange={setIsTakeoverDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Take over editing?</AlertDialogTitle>
            <AlertDialogDescription>
              {getDocumentEditLockOwnerName(editLock.lock)} is editing this document. If you proceed, they will be moved back to view mode.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleTakeover()}>
              Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
