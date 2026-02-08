'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@altitutor/ui';
import { Form, FormControl, FormField, FormItem } from '@altitutor/ui';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { NoteEditor } from './NoteEditor';
import { useNote } from '../api/queries';
import { useUpdateNote, useDeleteNote } from '../api/mutations';
import { useFolders } from '../api/queries';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
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

  const handleDelete = async () => {
    if (!note) return;
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      await deleteNote.mutateAsync(noteId);
      router.push('/notes');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const {
    ref: titleRef,
    handleBlur: handleTitleBlur,
    handleInput: handleTitleInput,
  } = useContentEditableField(form, 'title', form.watch('title'));

  // Combine refs - memoize to ensure stability
  const combinedTitleRef = useCallback((node: HTMLDivElement | null) => {
    (titleRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    (titleFieldRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [titleRef]);

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!note) {
    return <div className="p-6">Note not found</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b p-4 space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/notes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
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
                        data-placeholder="Note title"
                        className="text-2xl font-semibold outline-none focus:outline-none focus:ring-0 border-none p-0 min-h-[40px] empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
                        suppressContentEditableWarning
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </Form>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Folder selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Folder:</span>
          <Form {...form}>
            <FormField
              control={form.control}
              name="folder_id"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Select
                      value={field.value || '__none__'}
                      onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="No folder" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {folders?.map((folder) => (
                          <SelectItem key={folder.id} value={folder.id}>
                            {folder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />
          </Form>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Form {...form}>
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <NoteEditor
                    key={noteId}
                    content={field.value}
                    onChange={field.onChange}
                    className="min-h-full"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </Form>
      </div>
    </div>
  );
}
