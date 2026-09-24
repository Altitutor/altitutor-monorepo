'use client';

import { useCallback, useState } from 'react';
import { Input } from '@altitutor/ui';
import { AdminPageActionButton } from '@/shared/components';
import { Loader2, Plus, Search } from 'lucide-react';
import { FolderTree } from '@/features/notes/components/FolderTree';
import { EditDocumentDialog } from '@/features/notes/components/EditDocumentDialog';
import { EditProjectDialog } from '@/features/projects/components/EditProjectDialog';
import { useCreateNote } from '@/features/notes/hooks/useNoteMutations';
import { useUrlQueryParam } from '@/shared/hooks/useUrlQueryParam';

type DocumentMode = 'view' | 'edit';

export default function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useUrlQueryParam('search');
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [documentInitialMode, setDocumentInitialMode] = useState<DocumentMode>('view');
  const [editProjectId, setEditProjectId] = useState<string | null>(null);

  const createNote = useCreateNote();

  const openDocument = useCallback((noteId: string, mode: DocumentMode = 'view') => {
    setDocumentInitialMode(mode);
    setEditNoteId(noteId);
  }, []);

  const closeDocument = useCallback(() => {
    setEditNoteId(null);
    setDocumentInitialMode('view');
  }, []);

  const handleNewDocument = useCallback(async () => {
    if (createNote.isPending) return;
    try {
      const note = await createNote.mutateAsync({
        title: 'Untitled',
        content: '',
        folder_id: null,
      });
      openDocument(note.id, 'edit');
    } catch {
      // mutation surfaces errors
    }
  }, [createNote, openDocument]);

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--navbar-height)-4rem)] p-6">
      <div className="flex items-center justify-between flex-shrink-0 mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <AdminPageActionButton
          icon={createNote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          label={createNote.isPending ? 'Creating...' : 'New document'}
          onClick={() => void handleNewDocument()}
          disabled={createNote.isPending}
        />
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
          onNoteClick={(noteId) => openDocument(noteId, 'view')}
          onNoteCreated={(noteId) => openDocument(noteId, 'edit')}
          onProjectClick={(projectId) => setEditProjectId(projectId)}
        />
      </div>

      <EditDocumentDialog
        isOpen={!!editNoteId}
        onClose={closeDocument}
        noteId={editNoteId}
        initialMode={documentInitialMode}
      />
      <EditProjectDialog
        isOpen={!!editProjectId}
        onClose={() => setEditProjectId(null)}
        projectId={editProjectId}
      />
    </div>
  );
}
