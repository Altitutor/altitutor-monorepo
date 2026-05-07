'use client';

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  ScrollArea,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  type JSONContent,
  type MentionClickDetail,
} from '@altitutor/ui';
import { NoteEditor, type NoteEditorRef } from './NoteEditor';
import { NotePropertiesPanel } from './NotePropertiesPanel';
import { NotePropertyPills } from './NotePropertyPills';
import { NoteTableOfContentsWithLiveTitle } from './NoteTableOfContents';
import { NoteEditorBottomToolbar } from './NoteEditorBottomToolbar';
import type { Editor } from '@tiptap/react';
import type { NoteUpdate } from '../types';
import { useNote } from '../api/queries';
import { useUpdateNote, useDeleteNote } from '../hooks/useNoteMutations';
import { useFolders } from '../api/queries';
import { useContentEditableField } from '@/features/tasks/hooks/useContentEditableField';
import { useSidebarWidth } from '../hooks/useSidebarWidth';
import { NoteAutoSaveBridge } from '../hooks/useNoteAutoSave';
import { useHydrateLinkedNoteTitles } from '../hooks/useHydrateLinkedNoteTitles';
import { DOCUMENT_NOTE_MENTION_TYPES } from '../constants/documentEditorMentions';
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
});

interface NoteDetailPageProps {
  noteId: string;
}

export function NoteDetailPage({ noteId }: NoteDetailPageProps) {
  const router = useRouter();
  const { data: note, isLoading } = useNote(noteId);
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const { data: folders } = useFolders();
  const sidebarWidth = useSidebarWidth();
  const [isMobile, setIsMobile] = useState(false);

  const titleFieldRef = useRef<HTMLDivElement>(null);
  const noteEditorRef = useRef<NoteEditorRef>(null);
  const editorInstanceRef = useRef<Editor | null>(null);

  const currentNoteIdRef = useRef<string | null>(null);
  const isUpdatingFromServerRef = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initialFocusDone, setInitialFocusDone] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const lastBlurSavedTitleRef = useRef<string | null>(null);

  const form = useForm<NoteFormData, unknown, NoteFormData>({
    resolver: zodResolver(formSchema) as Resolver<NoteFormData>,
    defaultValues: {
      title: '',
      content: '',
      folder_id: null,
      project_id: null,
    },
  });

  const mentionSuggestions = useMentionSuggestions({
    types: DOCUMENT_NOTE_MENTION_TYPES,
    excludeIds: [noteId],
  });

  useHydrateLinkedNoteTitles({
    form,
    noteId,
    isInitialized,
    isUpdatingFromServerRef,
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
      setIsInitialized(false);
      setInitialFocusDone(false);
      lastBlurSavedTitleRef.current = null;
      currentNoteIdRef.current = noteId;
    }

    if (note && !isInitialized) {
      isUpdatingFromServerRef.current = true;
      form.reset({
        title: note.title,
        content: (note.content as unknown as JSONContent) || '',
        folder_id: note.folder_id,
        project_id: (note as { project_id?: string | null }).project_id ?? null,
      });
      lastBlurSavedTitleRef.current = note.title;
      setIsInitialized(true);
      setTimeout(() => {
        isUpdatingFromServerRef.current = false;
      }, 0);
    } else if (note && isInitialized && note.title !== lastBlurSavedTitleRef.current) {
      lastBlurSavedTitleRef.current = note.title;
    }
  }, [note, noteId, form, isInitialized]);

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

  const {
    ref: titleRef,
    handleBlur: handleTitleBlurBase,
    handleInput: handleTitleInput,
  } = useContentEditableField(form, 'title', form.watch('title'));

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
        isInitialized={isInitialized}
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
                  {updateNote.isPending ? (
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
                          contentEditable
                          onBlur={handleTitleBlur}
                          onInput={handleTitleInput}
                          onKeyDown={handleTitleKeyDown}
                          data-placeholder="Untitled"
                          className="text-4xl font-semibold tracking-tight leading-tight outline-none focus:outline-none focus:ring-0 border-none p-0 min-h-[44px] empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground max-md:whitespace-normal max-md:break-words md:whitespace-nowrap md:overflow-hidden"
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
                <NotePropertyPills form={form} folders={foldersArray} />
              </div>

              <div className="md:hidden mb-6">
                <NoteTableOfContentsWithLiveTitle
                  control={form.control}
                  editor={editorInstanceRef.current}
                  collapsible
                />
              </div>

              <div className="max-w-3xl mx-auto w-full relative flex-1 flex flex-col min-h-0">
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem className="flex-1 flex flex-col min-h-0">
                      <FormControl className="flex-1 flex flex-col min-h-0">
                        <NoteEditor
                          ref={noteEditorRef}
                          content={field.value}
                          onChange={field.onChange}
                          placeholder="Start writing..."
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
      </div>

      <div className="hidden md:flex w-80 min-w-[320px] flex-col overflow-hidden border-l">
        <Tabs defaultValue="outline" className="flex-1 flex flex-col min-h-0">
          <div className="flex-shrink-0 border-b bg-background px-6 pb-4 pt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="properties">Properties</TabsTrigger>
              <TabsTrigger value="outline">Outline</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <TabsContent value="properties" className="h-full min-h-0 m-0 data-[state=active]:flex flex-col overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="p-6">
                  <NotePropertiesPanel
                    form={form}
                    folders={foldersArray}
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="outline" className="h-full min-h-0 m-0 overflow-hidden data-[state=active]:flex flex-col">
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-6">
                  <NoteTableOfContentsWithLiveTitle
                    control={form.control}
                    editor={editorInstanceRef.current}
                  />
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </div>
      <SaveAsTemplateDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        initialContent={form.getValues('content') ?? null}
        onSuccess={() => setIsSaveDialogOpen(false)}
      />
    </div>
  );
}
