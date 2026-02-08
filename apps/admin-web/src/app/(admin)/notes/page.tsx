'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { Plus, FolderPlus } from 'lucide-react';
import { FolderTree } from '@/features/notes/components/FolderTree';
import { CreateNoteDialog } from '@/features/notes/components/CreateNoteDialog';
import { CreateFolderDialog } from '@/features/notes/components/CreateFolderDialog';

export default function NotesPage() {
  const [isCreateNoteOpen, setIsCreateNoteOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);

  return (
    <div className="flex flex-col h-[calc(100vh-var(--navbar-height)-4rem)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 mb-6">
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

      {/* Folder Tree */}
      <div className="flex-1 overflow-y-auto">
        <FolderTree />
      </div>

      {/* Dialogs */}
      <CreateNoteDialog
        isOpen={isCreateNoteOpen}
        onClose={() => setIsCreateNoteOpen(false)}
      />
      <CreateFolderDialog
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
      />
    </div>
  );
}
