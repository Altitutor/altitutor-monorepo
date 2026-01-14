'use client';

import { useNotepadStore } from '../state/notepadStore';
import { useChatStore } from '@/features/messages/state/chatStore';
import { useNotepad } from '../hooks/useNotepad';
import { useUpdateNotepad } from '../hooks/useUpdateNotepad';
import { ClipboardList } from 'lucide-react';

export function NotepadButton() {
  const isOpen = useNotepadStore((s) => s.isOpen);
  const content = useNotepadStore((s) => s.content);
  const toggleOpen = useNotepadStore((s) => s.toggleOpen);
  const setOpen = useNotepadStore((s) => s.setOpen);
  const minimized = useChatStore((s) => s.minimized);
  const { data: notepad } = useNotepad();
  const updateNotepadMutation = useUpdateNotepad();

  // Hide when chat is expanded (not minimized) - same logic as QuickActionsMenu
  if (!minimized) {
    return null;
  }

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
