'use client';

import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Button, Input } from '@altitutor/ui';
import { useCreateNote } from '../hooks/useNoteMutations';
import { cn } from '@/shared/utils';

interface FolderInlineCreateDocumentProps {
  folderId: string | null;
  indent: number;
  onCreated: (noteId: string) => void;
}

/**
 * Inline title + Create button at the bottom of a folder (or "No folder") list.
 */
export function FolderInlineCreateDocument({ folderId, indent, onCreated }: FolderInlineCreateDocumentProps) {
  const [title, setTitle] = useState('');
  const createNote = useCreateNote();

  const handleCreate = useCallback(async () => {
    const t = title.trim();
    if (!t || createNote.isPending) return;
    try {
      const note = await createNote.mutateAsync({
        title: t,
        content: '',
        folder_id: folderId,
      });
      setTitle('');
      onCreated(note.id);
    } catch {
      // mutation surfaces errors
    }
  }, [title, folderId, createNote, onCreated]);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 py-1.5 px-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/20'
      )}
      style={{ marginLeft: `${indent}px` }}
    >
      <Plus className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New document title…"
        className="h-9 text-base flex-1 min-w-[140px]"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void handleCreate();
          }
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={!title.trim() || createNote.isPending}
        onClick={() => void handleCreate()}
      >
        Create
      </Button>
    </div>
  );
}
