'use client';

import { useCallback, useState } from 'react';
import { Button, Input } from '@altitutor/ui';
import { Loader2, Plus, Search } from 'lucide-react';
import { FolderTree } from '@/features/notes/components/FolderTree';
import { EditDocumentDialog } from '@/features/notes/components/EditDocumentDialog';
import { EditProjectDialog } from '@/features/projects/components/EditProjectDialog';
import { useCreateNote } from '@/features/notes/hooks/useNoteMutations';

export default function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);

  const createNote = useCreateNote();

  const handleNewDocument = useCallback(async () => {
    if (createNote.isPending) return;
    try {
      const note = await createNote.mutateAsync({
        title: 'Untitled',
        content: '',
        folder_id: null,
      });
      setEditNoteId(note.id);
    } catch {
      // mutation surfaces errors
    }
  }, [createNote]);

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--navbar-height)-4rem)] p-6">
      <div className="flex items-center justify-between flex-shrink-0 mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <Button onClick={() => void handleNewDocument()} disabled={createNote.isPending}>
          {createNote.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating…
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              New document
            </>
          )}
        </Button>
      </div>

      <div className="relative flex-shrink-0 mb-4">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search documents by title or content..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <FolderTree
          searchQuery={searchQuery.trim()}
          onNoteClick={(noteId) => setEditNoteId(noteId)}
          onProjectClick={(projectId) => setEditProjectId(projectId)}
        />
      </div>

      <EditDocumentDialog
        isOpen={!!editNoteId}
        onClose={() => setEditNoteId(null)}
        noteId={editNoteId}
      />
      <EditProjectDialog
        isOpen={!!editProjectId}
        onClose={() => setEditProjectId(null)}
        projectId={editProjectId}
      />
    </div>
  );
}
