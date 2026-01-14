'use client';

import { useNotepadStore } from '../state/notepadStore';
import { useChatStore } from '@/features/messages/state/chatStore';
import { ClipboardList } from 'lucide-react';

export function NotepadButton() {
  const isOpen = useNotepadStore((s) => s.isOpen);
  const toggleOpen = useNotepadStore((s) => s.toggleOpen);
  const minimized = useChatStore((s) => s.minimized);

  // Hide when chat is expanded (not minimized) - same logic as QuickActionsMenu
  if (!minimized) {
    return null;
  }

  return (
    <div className="fixed bottom-44 right-4 z-50">
      <button
        onClick={toggleOpen}
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
