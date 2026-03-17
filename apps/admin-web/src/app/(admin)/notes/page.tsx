'use client';

import { useState } from 'react';
import { Button, Input } from '@altitutor/ui';
import { Plus, FolderPlus, Search } from 'lucide-react';
import { FolderTree } from '@/features/notes/components/FolderTree';
import { CreateNoteDialog } from '@/features/notes/components/CreateNoteDialog';
import { CreateFolderDialog } from '@/features/notes/components/CreateFolderDialog';
import { EditDocumentDialog } from '@/features/notes/components/EditDocumentDialog';
import { EditProjectDialog } from '@/features/projects/components/EditProjectDialog';

export default function NotesPage() {
  const [isCreateNoteOpen, setIsCreateNoteOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-[calc(100vh-var(--navbar-height)-4rem)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Notes</h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsCreateFolderOpen(true)} variant="outline">
            <FolderPlus className="h-4 w-4 mr-2" />
            Add Folder
          </Button>
          <Button onClick={() => setIsCreateNoteOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative flex-shrink-0 mb-4">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search notes by title or content..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Folder Tree or Search Results */}
      <div className="flex-1 overflow-y-auto">
        <FolderTree
          searchQuery={searchQuery.trim()}
          onNoteClick={(noteId) => setEditNoteId(noteId)}
          onProjectClick={(projectId) => setEditProjectId(projectId)}
        />
      </div>

      {/* Dialogs */}
      <CreateNoteDialog
        isOpen={isCreateNoteOpen}
        onClose={() => setIsCreateNoteOpen(false)}
        onNoteCreated={(noteId) => {
          setEditNoteId(noteId);
          setIsCreateNoteOpen(false);
        }}
      />
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
      <CreateFolderDialog
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
      />
    </div>
  );
}
