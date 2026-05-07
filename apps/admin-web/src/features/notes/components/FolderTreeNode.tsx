'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FolderTreeItem } from '../types';
import { DraggableNote } from './DraggableNote';
import { DraggableFolder } from './DraggableFolder';
import { DroppableFolder } from './DroppableFolder';
import { FolderInlineCreateDocument } from './FolderInlineCreateDocument';

interface FolderTreeNodeProps {
  folder: FolderTreeItem;
  level?: number;
  onNoteClick?: (noteId: string) => void;
  onProjectClick?: (projectId: string) => void;
  projects?: Array<{ id: string; name: string | null }>;
}

/**
 * Recursive component for rendering folder tree nodes
 */
export function FolderTreeNode({ folder, level = 0, onNoteClick, onProjectClick, projects = [] }: FolderTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();

  const indent = level * 20;

  const handleFolderClick = () => {
    setIsExpanded(!isExpanded);
  };

  const handleNoteClick = (noteId: string) => {
    if (onNoteClick) {
      onNoteClick(noteId);
    } else {
      router.push(`/documents/${noteId}`);
    }
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
            {folder.notes.map((note) => {
              const project = note.project_id
                ? projects.find((p) => p.id === note.project_id)
                : null;
              return (
                <DraggableNote
                  key={note.id}
                  note={note}
                  project={project ? { id: project.id, name: project.name } : undefined}
                  onClick={() => handleNoteClick(note.id)}
                  onProjectClick={onProjectClick}
                  indent={indent + 36}
                />
              );
            })}

            {/* Subfolders */}
            {folder.children.map((childFolder) => (
              <FolderTreeNode
                key={childFolder.id}
                folder={childFolder}
                level={level + 1}
                onNoteClick={onNoteClick}
                onProjectClick={onProjectClick}
                projects={projects}
              />
            ))}

            <FolderInlineCreateDocument
              folderId={folder.id}
              indent={indent + 36}
              onCreated={(id) => handleNoteClick(id)}
            />
          </div>
        )}
      </div>
    </DroppableFolder>
  );
}
