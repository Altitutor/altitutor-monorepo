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
  Form,
  FormControl,
  FormField,
  FormItem,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  ScrollArea,
  type JSONContent,
  type MentionClickDetail,
} from '@altitutor/ui';
import { MoreVertical, ExternalLink, Trash2, X, Loader2, Check, CloudOff } from 'lucide-react';
import { RichTextTemplateMenuItems } from '@/features/rich-text-templates/components/RichTextTemplateMenuItems';
import { SaveAsTemplateDialog } from '@/features/rich-text-templates/components/SaveAsTemplateDialog';
import type { Editor } from '@tiptap/react';
import { useNote, useFolders } from '../api/queries';
import { useDeleteNote, useUpdateNote } from '../hooks/useNoteMutations';
import { NoteAutoSaveBridge } from '../hooks/useNoteAutoSave';
import { useHydrateLinkedNoteTitles } from '../hooks/useHydrateLinkedNoteTitles';
import { DOCUMENT_NOTE_MENTION_TYPES } from '../constants/documentEditorMentions';
import { NoteEditor, type NoteEditorRef } from './NoteEditor';
import { NoteEditorBottomToolbar } from './NoteEditorBottomToolbar';
import { NotePropertiesPanel } from './NotePropertiesPanel';
import { NotePropertyPills } from './NotePropertyPills';
import { NoteTableOfContents } from './NoteTableOfContents';
import type { NoteFormData, NoteUpdate } from '../types';
import type { Resolver } from 'react-hook-form';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import { useMentionSuggestions } from '@/shared/hooks/useMentionSuggestions';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.any(),
  folder_id: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
});

interface EditDocumentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string | null;
}

export function EditDocumentDialog({ isOpen, onClose, noteId }: EditDocumentDialogProps) {
  const router = useRouter();
  const noteEditorRef = useRef<NoteEditorRef>(null);
  const lastResetNoteIdRef = useRef<string | null>(null);
  const isUpdatingFromServerRef = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [linkedDocumentId, setLinkedDocumentId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setExpanded(false);
      setLinkedDocumentId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setLinkedDocumentId(null);
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

  const form = useForm<NoteFormData>({
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
    excludeIds: noteId ? [noteId] : [],
  });

  useHydrateLinkedNoteTitles({
    form,
    noteId,
    isInitialized,
    isUpdatingFromServerRef,
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
      note.id !== noteId ||
      note.id === lastResetNoteIdRef.current
    ) {
      return;
    }
    setEditorInstance(null);
    isUpdatingFromServerRef.current = true;
    form.reset({
      title: note.title,
      content: (note.content as JSONContent) || '',
      folder_id: note.folder_id,
      project_id: (note as { project_id?: string | null }).project_id ?? null,
    });
    lastResetNoteIdRef.current = note.id;
    setIsInitialized(true);
    queueMicrotask(() => {
      isUpdatingFromServerRef.current = false;
    });
  }, [note, isOpen, isLoading, noteId, form]);

  useEffect(() => {
    if (!isOpen) {
      lastResetNoteIdRef.current = null;
      setIsInitialized(false);
      setEditorInstance(null);
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

  const handleDelete = useCallback(async () => {
    if (!noteId) return;
    await deleteNote.mutateAsync(noteId);
    onClose();
  }, [noteId, deleteNote, onClose]);

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
                {updateNote.isPending ? (
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
                  isInitialized={isInitialized}
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
                    <div className="mx-auto max-w-3xl space-y-4 pb-6 pl-[2.75rem] pr-6 pt-6">
                      <div className="md:hidden">
                        <NotePropertyPills form={form} folders={folders || []} />
                      </div>

                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <input
                                value={field.value || ''}
                                onChange={field.onChange}
                                placeholder="Untitled"
                                className="w-full text-4xl font-semibold tracking-tight leading-tight bg-transparent outline-none border-none"
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
                                key={noteId}
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
                  </div>

                  <div className="flex-shrink-0 px-4 pb-4 pt-2">
                    <NoteEditorBottomToolbar editor={editorInstance} />
                  </div>
                </div>

                <div className="hidden md:flex w-80 min-w-[320px] flex-col overflow-hidden border-l">
                  <Tabs defaultValue="properties" className="flex-1 flex flex-col min-h-0">
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
                              folders={folders || []}
                            />
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="outline" className="h-full min-h-0 m-0 overflow-hidden data-[state=active]:flex flex-col">
                        <ScrollArea className="flex-1 min-h-0">
                          <div className="p-6">
                            <NoteTableOfContents editor={editorInstance} />
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    </div>
                  </Tabs>
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
    </>
  );
}
