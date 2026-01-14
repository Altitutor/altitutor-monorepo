'use client';

import { useEffect, useRef } from 'react';
import { useNotepadStore } from '../state/notepadStore';
import { useNotepad } from '../hooks/useNotepad';
import { cn } from '@/shared/utils';

export function NotepadPanel() {
  const isOpen = useNotepadStore((s) => s.isOpen);
  const content = useNotepadStore((s) => s.content);
  const setContent = useNotepadStore((s) => s.setContent);
  const { data: notepad, isLoading } = useNotepad();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load notepad content when opened
  useEffect(() => {
    if (isOpen && notepad) {
      setContent(notepad.content ?? '');
    } else if (isOpen && !isLoading && !notepad) {
      // No notepad exists yet, start with empty
      setContent('');
    }
  }, [isOpen, notepad, isLoading, setContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  // Focus textarea when opened and position cursor at end
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      // Small delay to ensure panel is rendered
      setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
          // Set cursor position to end of text
          const length = textarea.value.length;
          textarea.setSelectionRange(length, length);
        }
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-[calc(1rem+64px+1rem)] z-50 w-[400px] max-w-[calc(100vw-1rem-64px-1rem-1rem)] h-[400px] max-h-[calc(100vh-2rem)] shadow-lg rounded-md border bg-background dark:bg-brand-dark-card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-brand-dark-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">Notepad</span>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Loading...
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your notes here..."
            className={cn(
              'w-full flex-1 resize-none border-0 bg-transparent',
              'focus:outline-none focus:ring-0',
              'text-sm placeholder:text-muted-foreground',
              'overflow-y-auto'
            )}
            style={{ minHeight: '200px' }}
          />
        )}
      </div>

    </div>
  );
}
