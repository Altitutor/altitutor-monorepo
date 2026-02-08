'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/shared/utils';
import type { FolderTreeItem } from '../types';
import { DraggableNote } from './DraggableNote';
import { DraggableFolder } from './DraggableFolder';
import { DroppableFolder } from './DroppableFolder';

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
    <DroppableFolder folderId={folder.id}>
      <div>
        {/* Folder - now draggable */}
        <DraggableFolder
          folder={folder}
          onClick={handleFolderClick}
          indent={indent + 8}
          isExpanded={isExpanded}
          level={level}
        />

        {/* Expanded content */}
        {isExpanded && (
          <div>
            {/* Notes in this folder */}
            {folder.notes.map((note) => (
              <DraggableNote
                key={note.id}
                note={note}
                onClick={() => handleNoteClick(note.id)}
                indent={indent + 36}
              />
            ))}

            {/* Subfolders */}
            {folder.children.map((childFolder) => (
              <FolderTreeNode key={childFolder.id} folder={childFolder} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    </DroppableFolder>
  );
}
