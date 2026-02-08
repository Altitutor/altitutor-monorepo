'use client';

import { useRouter } from 'next/navigation';
import { useFolderTree, useNotes } from '../api/queries';
import { FolderTreeNode } from './FolderTreeNode';
import { Skeleton } from '@altitutor/ui';
import { FileText } from 'lucide-react';
import { cn } from '@/shared/utils';

/**
 * Main folder tree component showing root folders with notes and subfolders
 * Also displays notes without folders at the top
 */
export function FolderTree() {
  const router = useRouter();
  const { data: folderTree, isLoading: isLoadingFolders, error: foldersError } = useFolderTree();
  const { data: notesWithoutFolder, isLoading: isLoadingNotes } = useNotes({ folderId: null });

  const isLoading = isLoadingFolders || isLoadingNotes;
  const error = foldersError;

  const handleNoteClick = (noteId: string) => {
    router.push(`/notes/${noteId}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive p-4">
        Error loading folders: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const hasFolders = folderTree && folderTree.length > 0;
  const hasNotesWithoutFolder = notesWithoutFolder && notesWithoutFolder.length > 0;

  if (!hasFolders && !hasNotesWithoutFolder) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium mb-2">No folders or notes yet</p>
        <p className="text-sm">Create a folder or note to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Notes without folders */}
      {hasNotesWithoutFolder && (
        <div className="mb-4">
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            No Folder
          </div>
          {notesWithoutFolder.map((note) => (
            <div
              key={note.id}
              className={cn(
                'flex items-center gap-2 py-1 px-2 rounded-md hover:bg-muted/50 cursor-pointer',
                'text-sm'
              )}
              style={{ paddingLeft: '8px' }}
              onClick={() => handleNoteClick(note.id)}
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{note.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Folders */}
      {hasFolders && (
        <>
          {hasNotesWithoutFolder && (
            <div className="border-t my-2" />
          )}
          {folderTree.map((folder) => (
            <FolderTreeNode key={folder.id} folder={folder} level={0} />
          ))}
        </>
      )}
    </div>
  );
}
