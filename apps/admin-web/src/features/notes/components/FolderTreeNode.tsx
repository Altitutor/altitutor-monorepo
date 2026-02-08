'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronDown, Folder, FileText } from 'lucide-react';
import { cn } from '@/shared/utils';
import type { FolderTreeItem } from '../types';

interface FolderTreeNodeProps {
  folder: FolderTreeItem;
  level?: number;
}

/**
 * Recursive component for rendering folder tree nodes
 */
export function FolderTreeNode({ folder, level = 0 }: FolderTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();

  const hasChildren = folder.children.length > 0 || folder.notes.length > 0;
  const indent = level * 20;

  const handleFolderClick = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleNoteClick = (noteId: string) => {
    router.push(`/notes/${noteId}`);
  };

  return (
    <div>
      {/* Folder */}
      <div
        className={cn(
          'flex items-center gap-2 py-1 px-2 rounded-md hover:bg-accent cursor-pointer',
          level === 0 && 'font-medium'
        )}
        style={{ paddingLeft: `${indent + 8}px` }}
        onClick={handleFolderClick}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )
        ) : (
          <div className="w-4" />
        )}
        <Folder className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 truncate">{folder.name}</span>
        {(folder.notes.length > 0 || folder.children.length > 0) && (
          <span className="text-xs text-muted-foreground">
            {folder.notes.length + folder.children.length}
          </span>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div>
          {/* Notes in this folder */}
          {folder.notes.map((note) => (
            <div
              key={note.id}
              className={cn(
                'flex items-center gap-2 py-1 px-2 rounded-md hover:bg-accent cursor-pointer',
                'text-sm'
              )}
              style={{ paddingLeft: `${indent + 36}px` }}
              onClick={(e) => {
                e.stopPropagation();
                handleNoteClick(note.id);
              }}
            >
              <div className="w-4" />
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{note.title}</span>
            </div>
          ))}

          {/* Subfolders */}
          {folder.children.map((childFolder) => (
            <FolderTreeNode key={childFolder.id} folder={childFolder} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
