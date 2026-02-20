'use client';

import { useEffect, useRef, useState } from 'react';
import { useNotepadStore } from '../state/notepadStore';
import { useNotepad } from '../hooks/useNotepad';
import { useUpdateNotepad } from '../hooks/useUpdateNotepad';
import { ClipboardList } from 'lucide-react';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { cn } from '@/shared/utils';

type NotepadButtonProps = {
  variant?: 'floating' | 'inline';
};

export function NotepadButton({ variant = 'floating' }: NotepadButtonProps) {
  const isOpen = useNotepadStore((s) => s.isOpen);
  const content = useNotepadStore((s) => s.content);
  const toggleOpen = useNotepadStore((s) => s.toggleOpen);
  const setOpen = useNotepadStore((s) => s.setOpen);
  const { data: notepad } = useNotepad();
  const updateNotepadMutation = useUpdateNotepad();
  const [inlineOpen, setInlineOpen] = useState(false);
  const [inlineContent, setInlineContent] = useState('');
  const inlineTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (variant !== 'inline' || !inlineOpen || !inlineTextareaRef.current) return;
    setTimeout(() => {
      const textarea = inlineTextareaRef.current;
      if (!textarea) return;
      textarea.focus();
      const length = textarea.value.length;
      textarea.setSelectionRange(length, length);
    }, 0);
  }, [inlineOpen, variant]);

  const handleClick = async () => {
    if (isOpen) {
      // Save before closing
      if (content !== (notepad?.content ?? '')) {
        try {
          await updateNotepadMutation.mutateAsync(content);
        } catch (error) {
          // Error toast is handled by mutation
          console.error('Failed to save notepad:', error);
        }
      }
      setOpen(false);
    } else {
      toggleOpen();
    }
  };

  if (variant === 'inline') {
    const handleOpenChange = (nextOpen: boolean) => {
      if (nextOpen) {
        setInlineContent(notepad?.content ?? '');
        setInlineOpen(true);
        return;
      }

      if (inlineContent !== (notepad?.content ?? '')) {
        updateNotepadMutation.mutate(inlineContent);
      }
      setInlineOpen(false);
    };

    return (
      <Popover open={inlineOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant={inlineOpen ? 'secondary' : 'outline'}
            size="icon"
            className="h-9 w-9"
            title="Notepad"
            aria-label="Notepad"
          >
            <ClipboardList className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[380px] p-0">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-sm font-medium">Notepad</span>
          </div>
          <div className="p-3">
            <textarea
              ref={inlineTextareaRef}
              value={inlineContent}
              onChange={(e) => setInlineContent(e.target.value)}
              placeholder="Type your notes here..."
              className={cn(
                'w-full h-[280px] resize-none rounded-md border bg-background p-3 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ring'
              )}
            />
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="fixed bottom-44 right-4 z-50">
      <button
        onClick={handleClick}
        className={`w-16 h-16 rounded-full bg-accent text-accent-foreground dark:text-gray-900 flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform ${
          isOpen ? 'ring-2 ring-offset-2 ring-offset-background ring-accent' : ''
        }`}
        title={isOpen ? 'Close Notepad' : 'Open Notepad'}
        aria-label={isOpen ? 'Close Notepad' : 'Open Notepad'}
      >
        <ClipboardList className="h-6 w-6" />
      </button>
    </div>
  );
}
