'use client';

import { useFolderTree } from '../api/queries';
import { FolderTreeNode } from './FolderTreeNode';
import { Skeleton } from '@altitutor/ui';

/**
 * Main folder tree component showing root folders with notes and subfolders
 */
export function FolderTree() {
  const { data: folderTree, isLoading, error } = useFolderTree();

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

  if (!folderTree || folderTree.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium mb-2">No folders yet</p>
        <p className="text-sm">Create a folder to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {folderTree.map((folder) => (
        <FolderTreeNode key={folder.id} folder={folder} level={0} />
      ))}
    </div>
  );
}
