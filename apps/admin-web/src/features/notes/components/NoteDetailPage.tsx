'use client';

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, type JSONContent } from '@altitutor/ui';
import { NoteEditor, type NoteEditorRef } from './NoteEditor';
import { NotePropertiesPanel } from './NotePropertiesPanel';
import { NotePropertyPills } from './NotePropertyPills';
import { NoteTableOfContents } from './NoteTableOfContents';
import { NoteEditorBottomToolbar } from './NoteEditorBottomToolbar';
import type { Editor } from '@tiptap/react';
import { useNote } from '../api/queries';
import { useUpdateNote, useDeleteNote } from '../hooks/useNoteMutations';
import { useFolders } from '../api/queries';
import { useContentEditableField } from '@/features/tasks/hooks/useContentEditableField';
import { useSidebarWidth } from '../hooks/useSidebarWidth';
import { useNoteAutoSave } from '../hooks/useNoteAutoSave';
import { useMentionSuggestions } from '@/shared/hooks/useMentionSuggestions';
import type { NoteFormData } from '../types';
import type { Resolver } from 'react-hook-form';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.any(),
  folder_id: z.string().nullable().optional(),
});

interface NoteDetailPageProps {
  noteId: string;
}

const NOTE_MENTION_TYPES = ['issues', 'tasks', 'students', 'staff', 'parents', 'classes', 'subjects'] as const;

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
  const mentionSuggestions = useMentionSuggestions({
    types: NOTE_MENTION_TYPES,
  });
  
  // Track initialization state
  const currentNoteIdRef = useRef<string | null>(null);
  const isUpdatingFromServerRef = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initialFocusDone, setInitialFocusDone] = useState(false);
  
  // Track last saved title to prevent duplicate saves on blur
  const lastBlurSavedTitleRef = useRef<string | null>(null);

  const form = useForm<NoteFormData, unknown, NoteFormData>({
    resolver: zodResolver(formSchema) as Resolver<NoteFormData>,
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
      });
      lastBlurSavedTitleRef.current = note.title;
      setIsInitialized(true);
      // Reset flag after form values are set
      setTimeout(() => {
        isUpdatingFromServerRef.current = false;
      }, 0);
    } else if (note && isInitialized && note.title !== lastBlurSavedTitleRef.current) {
      // Update ref when note is updated from server (e.g., after auto-save completes)
      lastBlurSavedTitleRef.current = note.title;
    }
  }, [note, noteId, form, isInitialized]);

  // Auto-focus title field only on initial load (once per noteId).
  // Without the guard, every auto-save query invalidation would re-trigger
  // this effect and steal focus from the editor.
  useEffect(() => {
    if (note && titleFieldRef.current && !initialFocusDone) {
      setInitialFocusDone(true);
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
  }, [note, initialFocusDone]);

  // Auto-save hook
  useNoteAutoSave({
    form,
    noteId,
    note: note || undefined,
    isInitialized,
    isUpdatingFromServer: () => isUpdatingFromServerRef.current,
    onSave: (updates) => {
      updateNote.mutate({
        id: noteId,
        updates: updates as any,
        silent: true, // Silent auto-save
      });
    },
  });

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
    handleBlur: handleTitleBlurBase,
    handleInput: handleTitleInput,
  } = useContentEditableField(form, 'title', form.watch('title'));

  // Wrap blur handler to trigger immediate save on blur
  const handleTitleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    // First, update the form value (from useContentEditableField)
    handleTitleBlurBase(e);
    
    // Extract title directly from the contentEditable element to ensure we have the latest value
    const getTextWithLineBreaks = (element: HTMLElement): string => {
      return element.innerText || '';
    };
    const currentTitle = getTextWithLineBreaks(e.currentTarget);
    
    // Immediately save the title (bypassing debounce) if it changed
    // Compare against both note.title and lastBlurSavedTitleRef to prevent duplicate saves
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

  // Combine refs - memoize to ensure stability
  const combinedTitleRef = useCallback((node: HTMLDivElement | null) => {
    (titleRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    (titleFieldRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [titleRef]);

  // Handle Enter key in title - prevent newline and move focus to note editor
  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Move focus to note editor and place cursor at the end
      noteEditorRef.current?.focusToEnd();
    }
  }, []);

  // Handle editor ready callback
  const handleEditorReady = useCallback((editor: Editor) => {
    editorInstanceRef.current = editor;
  }, []);

  // Track mobile breakpoint for toolbar positioning
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
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
    <div className="flex h-[calc(100vh-var(--navbar-height)-5rem)] relative">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="px-6 pt-6 pb-2">
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
                            className="text-4xl font-semibold outline-none focus:outline-none focus:ring-0 border-none p-0 min-h-[40px] empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground whitespace-nowrap overflow-hidden"
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
          <div className="px-6 flex-1 flex flex-col min-h-0 pb-20">
            <Form {...form}>
              {/* Property Pills - Mobile Only */}
              <div className="md:hidden pt-4 mb-4">
                <NotePropertyPills form={form} folders={foldersArray} />
              </div>

              {/* Table of Contents - Mobile Only (Collapsible) */}
              <div className="md:hidden mb-6">
                <NoteTableOfContents editor={editorInstanceRef.current} collapsible />
              </div>

              {/* Editor Container with max-width */}
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
                          mentionSuggestions={mentionSuggestions as any}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </Form>
          </div>
        </div>

        {/* Fixed Toolbar at Bottom */}
        <div 
          className="fixed bottom-0 z-50 px-6 pb-4 bg-background pointer-events-none" 
          style={{ 
            // Mobile: full width minus floating action buttons (right-4 + w-16 = 80px)
            // Desktop: account for sidebar and properties panel
            left: isMobile ? 0 : `${sidebarWidth}px`,
            right: isMobile ? '80px' : '320px', // Properties sidebar width (w-80 = 320px)
          }}
        >
          <div className="pointer-events-auto">
            <NoteEditorBottomToolbar editor={editorInstanceRef.current} />
          </div>
        </div>
      </div>

      {/* Properties Sidebar - Desktop Only */}
      <div className="hidden md:flex flex-col h-[calc(100vh-var(--navbar-height)-5rem)] w-80 flex-shrink-0 sticky top-0">
        <div className="flex-1 overflow-y-auto m-4 mr-6 space-y-4">
          {/* Properties Panel */}
          <NotePropertiesPanel
            form={form}
            folders={foldersArray}
            onDelete={handleDelete}
            saveStatus={{
              isPending: updateNote.isPending,
              isError: updateNote.isError,
            }}
          />
          
          {/* Table of Contents Card */}
          <NoteTableOfContents editor={editorInstanceRef.current} />
        </div>
      </div>
    </div>
  );
}
