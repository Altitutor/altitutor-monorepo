'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Folder } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from '@altitutor/ui';
import { useCreateFolder, useCreateNote } from '../hooks/useNoteMutations';
import { cn } from '@/shared/utils';

type CreateKind = 'document' | 'folder';

interface FolderInlineCreateDocumentProps {
  folderId: string | null;
  indent: number;
  onCreated: (noteId: string) => void;
}

/**
 * "+ Create new" opens a menu (document vs folder), then inline name + Save.
 */
export function FolderInlineCreateDocument({ folderId, indent, onCreated }: FolderInlineCreateDocumentProps) {
  const [mode, setMode] = useState<'idle' | 'naming'>('idle');
  const [kind, setKind] = useState<CreateKind>('document');
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const createNote = useCreateNote();
  const createFolder = useCreateFolder();

  useEffect(() => {
    if (mode === 'naming') {
      inputRef.current?.focus();
    }
  }, [mode]);

  const resetIdle = useCallback(() => {
    setMode('idle');
    setName('');
  }, []);

  const handlePickKind = useCallback((next: CreateKind) => {
    setKind(next);
    setName('');
    setMode('naming');
  }, []);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (kind === 'document') {
      if (createNote.isPending) return;
      try {
        const note = await createNote.mutateAsync({
          title: trimmed,
          content: '',
          folder_id: folderId,
        });
        resetIdle();
        onCreated(note.id);
      } catch {
        // mutation surfaces errors
      }
      return;
    }

    if (createFolder.isPending) return;
    try {
      await createFolder.mutateAsync({
        name: trimmed,
        parent_id: folderId,
      });
      resetIdle();
    } catch {
      // mutation surfaces errors
    }
  }, [kind, name, folderId, createNote, createFolder, onCreated, resetIdle]);

  /** Extra inset so "+ Create new" aligns comfortably with file icons on note rows. */
  const rowStyle = { paddingLeft: `${indent + 10}px` } as const;

  const isSaving = kind === 'document' ? createNote.isPending : createFolder.isPending;

  if (mode === 'naming') {
    return (
      <div className={cn('flex items-center gap-2 py-1 px-2 rounded-md text-sm')} style={rowStyle}>
        <Input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={kind === 'document' ? 'Document title…' : 'Folder name…'}
          className="flex-1 min-w-0 h-8 text-sm border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-ring px-0"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSave();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              resetIdle();
            }
          }}
          disabled={isSaving}
          aria-label={kind === 'document' ? 'New document title' : 'New folder name'}
        />
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isSaving}
            onClick={() => resetIdle()}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!name.trim() || isSaving}
            onClick={() => void handleSave()}
          >
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full text-left text-sm py-1 px-2 rounded-md',
            'text-muted-foreground opacity-60 hover:opacity-90 hover:bg-muted/50',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
          )}
          style={rowStyle}
        >
          + Create new
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={() => handlePickKind('document')}>
          <FileText className="h-4 w-4 mr-2" />
          Create document
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handlePickKind('folder')}>
          <Folder className="h-4 w-4 mr-2" />
          Create folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
