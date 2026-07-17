'use client';

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  SegmentedControl,
  useToast,
  type JSONContent,
  type MentionClickDetail,
} from '@altitutor/ui';
import { NoteEditor, type NoteEditorRef } from './NoteEditor';
import { NoteDocumentSidebarPanel } from './NoteDocumentSidebarPanel';
import { NotePropertyPills } from './NotePropertyPills';
import { NoteTableOfContents } from './NoteTableOfContents';
import { NoteEditorBottomToolbar } from './NoteEditorBottomToolbar';
import type { Editor } from '@tiptap/react';
import type { NoteUpdate } from '../types';
import { useNote } from '../api/queries';
import { useUpdateNote, useDeleteNote } from '../hooks/useNoteMutations';
import { useFolders } from '../api/queries';
import { useContentEditableField } from '@/features/tasks/hooks/useContentEditableField';
import { useSidebarWidth } from '../hooks/useSidebarWidth';
import { NoteAutoSaveBridge } from '../hooks/useNoteAutoSave';
import {
  getDocumentEditLockOwnerName,
  isDocumentEditLockActive,
  useDocumentEditLock,
} from '../hooks/useDocumentEditLock';
import { DOCUMENT_NOTE_MENTION_TYPES } from '../constants/documentEditorMentions';
import { DOCUMENT_TITLE_FIELD_CLASS } from '../constants/documentTitle';
import { useFitDocumentTitle } from '../hooks/useFitDocumentTitle';
import type { NoteFormData } from '../types';
import type { Resolver } from 'react-hook-form';
import { Check, CloudOff, MoreVertical, Trash2 } from 'lucide-react';
import { RichTextTemplateMenuItems } from '@/features/rich-text-templates/components/RichTextTemplateMenuItems';
import { SaveAsTemplateDialog } from '@/features/rich-text-templates/components/SaveAsTemplateDialog';
import { useMentionSuggestions } from '@/shared/hooks/useMentionSuggestions';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.any(),
  folder_id: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
  is_tutor_documentation: z.boolean().optional(),
});

interface NoteDetailPageProps {
  noteId: string;
}

type DocumentMode = 'view' | 'edit';

export function NoteDetailPage({ noteId }: NoteDetailPageProps) {
  const router = useRouter();
  const { data: note, isLoading } = useNote(noteId);
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const editLock = useDocumentEditLock(noteId, true);
  const { data: folders } = useFolders();
  const sidebarWidth = useSidebarWidth();
  const [isMobile, setIsMobile] = useState(false);

  const titleFieldRef = useRef<HTMLDivElement>(null);
  const noteEditorRef = useRef<NoteEditorRef>(null);
  const editorInstanceRef = useRef<Editor | null>(null);

  const currentNoteIdRef = useRef<string | null>(null);
  const lastAppliedServerValuesRef = useRef<NoteFormData | null>(null);
  const lastAppliedServerUpdatedAtRef = useRef<string | null>(null);
  const lastLocalContentEditAtRef = useRef(0);
  const suppressLocalContentEditsUntilRef = useRef(0);
  const isUpdatingFromServerRef = useRef(false);
  const lastTakeoverLockTokenRef = useRef<string | null>(null);
  const editModePromptClicksRef = useRef(0);
  const lastEditModePromptAtRef = useRef(0);
  const editModeToastVisibleRef = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initialFocusDone, setInitialFocusDone] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [acceptedServerVersion, setAcceptedServerVersion] = useState<string>('');
  const [mode, setMode] = useState<DocumentMode>('view');
  const [isTakeoverDialogOpen, setIsTakeoverDialogOpen] = useState(false);
  const lastBlurSavedTitleRef = useRef<string | null>(null);
  const isEditing = mode === 'edit' && editLock.isHeldByThisWindow;
  const { toast } = useToast();

  const form = useForm<NoteFormData, unknown, NoteFormData>({
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
    excludeIds: [noteId],
  });

  const handleDocumentMentionClick = useCallback(
    (detail: MentionClickDetail) => {
      if (detail.type === 'note' && detail.id !== noteId) {
        router.push(`/documents/${detail.id}`);
        return true;
      }
      return false;
    },
    [noteId, router]
  );

  useEffect(() => {
    if (currentNoteIdRef.current !== noteId) {
      setMode('view');
      setIsInitialized(false);
      setInitialFocusDone(false);
      lastBlurSavedTitleRef.current = null;
      lastAppliedServerValuesRef.current = null;
      lastAppliedServerUpdatedAtRef.current = null;
      lastLocalContentEditAtRef.current = 0;
      suppressLocalContentEditsUntilRef.current = 0;
      editModePromptClicksRef.current = 0;
      lastEditModePromptAtRef.current = 0;
      editModeToastVisibleRef.current = false;
      setAcceptedServerVersion('');
      currentNoteIdRef.current = noteId;
    }

    if (!note) return;

    const nextValues: NoteFormData = {
      title: note.title,
      content: (note.content as unknown as JSONContent) || '',
      folder_id: note.folder_id,
      project_id: (note as { project_id?: string | null }).project_id ?? null,
      is_tutor_documentation: Boolean(note.is_tutor_documentation),
    };
    const hasServerChange = note.updated_at !== lastAppliedServerUpdatedAtRef.current;
    const hasRecentLocalContentEdit = Date.now() - lastLocalContentEditAtRef.current < 5000;
    const currentValues = form.getValues();

    if (!isInitialized || (hasServerChange && !hasRecentLocalContentEdit && !updateNote.isPending)) {
      isUpdatingFromServerRef.current = true;
      form.reset(nextValues);
      lastBlurSavedTitleRef.current = note.title;
      lastAppliedServerValuesRef.current = nextValues;
      lastAppliedServerUpdatedAtRef.current = note.updated_at;
      suppressLocalContentEditsUntilRef.current = Date.now() + 1000;
      setAcceptedServerVersion(note.updated_at);
      setIsInitialized(true);
      setTimeout(() => {
        isUpdatingFromServerRef.current = false;
      }, 0);
    } else if (hasServerChange && hasRecentLocalContentEdit && !updateNote.isPending && !isEditing) {
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
      lastBlurSavedTitleRef.current = note.title;
      setTimeout(() => {
        isUpdatingFromServerRef.current = false;
      }, 0);
    } else if (JSON.stringify(currentValues) === JSON.stringify(nextValues)) {
      lastAppliedServerValuesRef.current = nextValues;
      lastAppliedServerUpdatedAtRef.current = note.updated_at;
      lastBlurSavedTitleRef.current = note.title;
    } else if (isInitialized && note.title !== lastBlurSavedTitleRef.current) {
      lastBlurSavedTitleRef.current = note.title;
    }
  }, [note, noteId, form, isInitialized, updateNote.isPending, isEditing]);

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
    if (note && titleFieldRef.current && !initialFocusDone) {
      setInitialFocusDone(true);
      const timer = setTimeout(() => {
        const titleElement = titleFieldRef.current;
        if (!titleElement) return;

        titleElement.focus();
        const selection = window.getSelection();
        if (!selection) return;

        const range = document.createRange();
        range.selectNodeContents(titleElement);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [note, initialFocusDone]);

  const handleDelete = useCallback(async () => {
    if (!note) return;
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await deleteNote.mutateAsync(noteId);
      router.push('/documents');
    } catch {
      // no-op
    }
  }, [note, noteId, deleteNote, router]);

  const titleText = form.watch('title');
  useFitDocumentTitle(titleFieldRef, titleText);

  const {
    ref: titleRef,
    handleBlur: handleTitleBlurBase,
    handleInput: handleTitleInput,
  } = useContentEditableField(form, 'title', titleText);

  const handleTitleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    handleTitleBlurBase(e);

    const currentTitle = e.currentTarget.innerText || '';

    if (
      note &&
      currentTitle &&
      currentTitle !== note.title &&
      currentTitle !== lastBlurSavedTitleRef.current
    ) {
      lastBlurSavedTitleRef.current = currentTitle;
      updateNote.mutate({
        id: noteId,
        updates: { title: currentTitle },
        silent: true,
      });
    }
  }, [handleTitleBlurBase, note, noteId, updateNote]);

  const combinedTitleRef = useCallback((node: HTMLDivElement | null) => {
    (titleRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    (titleFieldRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [titleRef]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      noteEditorRef.current?.focusToEnd();
    }
  }, []);

  const handleEditorReady = useCallback((editor: Editor) => {
    editorInstanceRef.current = editor;
  }, []);

  const enterEditMode = useCallback(async () => {
    await editLock.acquire();
    setMode('edit');
  }, [editLock]);

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

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const foldersArray = useMemo(() => folders || [], [folders]);

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!note) {
    return <div className="p-6">Document not found</div>;
  }

  return (
    <div className="flex h-[calc(100dvh-var(--navbar-height)-5rem)] relative">
      <NoteAutoSaveBridge
        form={form}
        noteId={noteId}
        note={note || undefined}
        isInitialized={isInitialized && isEditing}
        isUpdatingFromServer={() => isUpdatingFromServerRef.current}
        onSave={(updates) => {
          updateNote.mutate({
            id: noteId,
            updates: updates as NoteUpdate,
            silent: true,
          });
        }}
      />
      <div className="flex-1 flex flex-col min-w-0 border-r overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pt-6">
            <div className="max-w-3xl mx-auto w-full relative">
              <div className="hidden md:flex items-center gap-2 absolute top-0 right-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                  {isEditing && updateNote.isPending ? (
                    <>
                      <CloudOff className="h-3 w-3 animate-pulse" />
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <RichTextTemplateMenuItems
                      getEditor={() => noteEditorRef.current?.getEditor() ?? null}
                      getCurrentContent={() => form.getValues('content') ?? null}
                      onSaveAsTemplateClick={() => setIsSaveDialogOpen(true)}
                    />
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleDelete} className="!text-destructive focus:!text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete document
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Form {...form}>
                <FormField
                  control={form.control}
                  name="title"
                  render={() => (
                    <FormItem>
                      <FormControl>
                        <div
                          ref={combinedTitleRef}
                          contentEditable={isEditing}
                          onBlur={handleTitleBlur}
                          onInput={handleTitleInput}
                          onKeyDown={handleTitleKeyDown}
                          onPointerDownCapture={() => {
                            if (!isEditing) showEditModeToast();
                          }}
                          onFocus={() => {
                            if (!isEditing) showEditModeToast();
                          }}
                          data-placeholder="Untitled"
                          className={`${DOCUMENT_TITLE_FIELD_CLASS} outline-none focus:outline-none focus:ring-0 border-none p-0 min-h-[44px] empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground max-md:whitespace-normal max-md:break-words md:whitespace-nowrap`}
                          suppressContentEditableWarning
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </Form>
            </div>
          </div>

          <div className="px-6 pt-8 flex-1 flex flex-col min-h-0">
            <Form {...form}>
              <div className="md:hidden pt-4 mb-4">
                <NotePropertyPills form={form} folders={foldersArray} editable={isEditing} />
              </div>

              <div className="md:hidden mb-6">
                <NoteTableOfContents
                  editor={editorInstanceRef.current}
                  collapsible
                />
              </div>

              <div
                className="max-w-3xl mx-auto w-full relative flex-1 flex flex-col min-h-0"
                onPointerDownCapture={() => {
                  if (!isEditing) showEditModeToast();
                }}
              >
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem className="flex-1 flex flex-col min-h-0">
                      <FormControl className="flex-1 flex flex-col min-h-0">
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
            </Form>
          </div>
        </div>

        {isEditing ? (
          <div
            className="flex-shrink-0 px-6 pointer-events-none"
            style={{
              left: isMobile ? 0 : `${sidebarWidth}px`,
              right: isMobile ? '80px' : '320px',
            }}
          >
            <div className="pointer-events-auto max-w-3xl mx-auto">
              <NoteEditorBottomToolbar editor={editorInstanceRef.current} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="hidden md:flex w-80 min-w-[320px] flex-col overflow-hidden border-l">
        <NoteDocumentSidebarPanel
          form={form}
          folders={foldersArray}
          editable={isEditing}
          editor={editorInstanceRef.current}
          onViewModeInteract={() => {
            if (!isEditing) showEditModeToast();
          }}
        />
      </div>
      <SaveAsTemplateDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        initialContent={form.getValues('content') ?? null}
        onSuccess={() => setIsSaveDialogOpen(false)}
      />
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
    </div>
  );
}
