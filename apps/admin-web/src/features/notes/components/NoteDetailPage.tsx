'use client';

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@altitutor/ui';
import { Form, FormControl, FormField, FormItem } from '@altitutor/ui';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { NoteEditor } from './NoteEditor';
import { NotePropertiesPanel } from './NotePropertiesPanel';
import { NotePropertyPills } from './NotePropertyPills';
import { useNote } from '../api/queries';
import { useUpdateNote, useDeleteNote } from '../api/mutations';
import { useFolders } from '../api/queries';
import { useDebounce } from '@/shared/hooks';
import { useContentEditableField } from '@/features/tasks/hooks/useContentEditableField';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string(),
  folder_id: z.string().nullable().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface NoteDetailPageProps {
  noteId: string;
}

export function NoteDetailPage({ noteId }: NoteDetailPageProps) {
  const router = useRouter();
  const { data: note, isLoading } = useNote(noteId);
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const { data: folders } = useFolders();

  const titleFieldRef = useRef<HTMLDivElement>(null);
  const noteEditorRef = useRef<{ focus: () => void } | null>(null);
  const isInitializedRef = useRef(false);
  const currentNoteIdRef = useRef<string | null>(null);
  const isUpdatingFromServerRef = useRef(false);
  const lastSavedValuesRef = useRef<{ title?: string; content?: string; folder_id?: string | null }>({});

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      content: '',
      folder_id: null,
    },
  });

  // Initialize form data when note loads (only once per noteId)
  useEffect(() => {
    // Reset initialization if noteId changed (user navigated to different note)
    if (currentNoteIdRef.current !== noteId) {
      isInitializedRef.current = false;
      currentNoteIdRef.current = noteId;
      lastSavedValuesRef.current = {};
    }

    if (note && !isInitializedRef.current) {
      isUpdatingFromServerRef.current = true;
      form.reset({
        title: note.title,
        content: note.content || '',
        folder_id: note.folder_id,
      });
      lastSavedValuesRef.current = {
        title: note.title,
        content: note.content || '',
        folder_id: note.folder_id,
      };
      isInitializedRef.current = true;
      // Reset flag after form values are set
      setTimeout(() => {
        isUpdatingFromServerRef.current = false;
      }, 0);
    }
  }, [note, noteId, form]);

  // Auto-focus title field when note loads
  useEffect(() => {
    if (note && titleFieldRef.current) {
      const timer = setTimeout(() => {
        const titleElement = titleFieldRef.current;
        if (!titleElement) return;
        
        titleElement.focus();
        // Place cursor at the end
        const selection = window.getSelection();
        if (!selection) return;
        
        const range = document.createRange();
        range.selectNodeContents(titleElement);
        range.collapse(false); // Collapse to end
        selection.removeAllRanges();
        selection.addRange(range);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [note]);

  // Debounced auto-save for title
  const title = form.watch('title');
  const debouncedTitle = useDebounce(title, 1000);
  useEffect(() => {
    if (!isInitializedRef.current || isUpdatingFromServerRef.current) return;
    if (note && debouncedTitle && debouncedTitle !== lastSavedValuesRef.current.title) {
      lastSavedValuesRef.current.title = debouncedTitle;
      updateNote.mutate({
        id: noteId,
        updates: { title: debouncedTitle },
        silent: true, // Silent auto-save
      });
    }
  }, [debouncedTitle, note, noteId, updateNote]);

  // Debounced auto-save for content
  const content = form.watch('content');
  const debouncedContent = useDebounce(content, 1000);
  useEffect(() => {
    if (!isInitializedRef.current || isUpdatingFromServerRef.current) return;
    if (note && debouncedContent !== undefined && debouncedContent !== lastSavedValuesRef.current.content) {
      lastSavedValuesRef.current.content = debouncedContent;
      updateNote.mutate({
        id: noteId,
        updates: { content: debouncedContent },
        silent: true, // Silent auto-save
      });
    }
  }, [debouncedContent, note, noteId, updateNote]);

  // Auto-save for folder_id
  const folderId = form.watch('folder_id');
  useEffect(() => {
    if (!isInitializedRef.current || isUpdatingFromServerRef.current) return;
    if (note && folderId !== lastSavedValuesRef.current.folder_id) {
      lastSavedValuesRef.current.folder_id = folderId;
      updateNote.mutate({
        id: noteId,
        updates: { folder_id: folderId },
        silent: true, // Silent auto-save
      });
    }
  }, [folderId, note, noteId, updateNote]);

  const handleDelete = useCallback(async () => {
    if (!note) return;
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      await deleteNote.mutateAsync(noteId);
      router.push('/notes');
    } catch (error) {
      // Error handled by mutation
    }
  }, [note, noteId, deleteNote, router]);

  const {
    ref: titleRef,
    handleBlur: handleTitleBlur,
    handleInput: handleTitleInputBase,
  } = useContentEditableField(form, 'title', form.watch('title'));

  // Wrap handleInput to strip line breaks from title
  const handleTitleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const text = element.innerText || '';
    // Strip line breaks and replace with space
    const singleLineText = text.replace(/\n/g, ' ').trim();
    
    // Update the element content if it had line breaks
    if (text !== singleLineText) {
      element.innerText = singleLineText;
      // Move cursor to end
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    
    // Call the base handler
    handleTitleInputBase(e);
  }, [handleTitleInputBase]);

  // Combine refs - memoize to ensure stability
  const combinedTitleRef = useCallback((node: HTMLDivElement | null) => {
    (titleRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    (titleFieldRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [titleRef]);

  // Handle Enter key in title - prevent new line and focus editor
  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      // Focus the note editor and move cursor to end
      if (noteEditorRef.current) {
        noteEditorRef.current.focus();
      }
    }
  }, []);

  // Memoize folders array for performance
  const foldersArray = useMemo(() => folders || [], [folders]);

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!note) {
    return <div className="p-6">Note not found</div>;
  }

  return (
    <div className="flex h-[calc(100vh-var(--navbar-height)-5rem)]">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex-shrink-0 p-6 pb-2">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-3xl mx-auto w-full">
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
                          className="text-2xl font-semibold outline-none focus:outline-none focus:ring-0 border-none p-0 min-h-[40px] empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
                          suppressContentEditableWarning
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </Form>
            </div>
          </div>
        </div>

        {/* Content Panel */}
        <div className="flex-1 overflow-hidden px-6 pb-6 pt-2 min-h-0">
          <Form {...form}>
            {/* Property Pills - Mobile Only */}
            <div className="md:hidden -mt-2 mb-6">
              <NotePropertyPills form={form} folders={foldersArray} />
            </div>

            {/* Editor Container with max-width */}
            <div className="max-w-3xl mx-auto w-full h-full relative">
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem className="h-full">
                    <FormControl>
                      <NoteEditor
                        ref={noteEditorRef}
                        content={field.value}
                        onChange={field.onChange}
                        placeholder="Start writing..."
                        className="min-h-full"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </Form>
        </div>
      </div>

      {/* Properties Sidebar - Desktop Only */}
      <NotePropertiesPanel form={form} folders={foldersArray} onDelete={handleDelete} />
    </div>
  );
}
