'use client';

import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { useFolderTree, useNotes } from '../api/queries';
import { useProjects } from '@/features/projects/api/queries';
import { FolderTreeNode } from './FolderTreeNode';
import { NotesSearchResults } from './NotesSearchResults';
import { Skeleton } from '@altitutor/ui';
import { useNoteDragAndDrop } from '../hooks/useNoteDragAndDrop';
import { useUpdateNote, useUpdateFolder } from '../hooks/useNoteMutations';
import { DraggableNote } from './DraggableNote';
import { DroppableNoFolder } from './DroppableNoFolder';
import { useMemo } from 'react';
import type { Note, FolderTreeItem } from '../types';

interface FolderTreeProps {
  searchQuery?: string;
  onNoteClick?: (noteId: string) => void;
  onProjectClick?: (projectId: string) => void;
}

/**
 * Main folder tree component showing root folders with notes and subfolders
 * Also displays notes without folders at the top.
 * When searchQuery is provided, shows search results instead.
 */
export function FolderTree({ searchQuery = '', onNoteClick, onProjectClick }: FolderTreeProps) {
  const router = useRouter();
  const isSearching = searchQuery.length > 0;
  const { data: projects = [] } = useProjects();

  const { data: folderTree, isLoading: isLoadingFolders, error: foldersError } = useFolderTree();
  const { data: notesWithoutFolder, isLoading: isLoadingNotes } = useNotes(
    { folderId: null },
    !isSearching
  );
  const { data: searchResults, isLoading: isLoadingSearch } = useNotes(
    { search: searchQuery },
    isSearching
  );

  const isLoading = isSearching
    ? isLoadingSearch
    : isLoadingFolders || isLoadingNotes;
  const error = foldersError;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before starting drag
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleNoteClick = (noteId: string) => {
    if (onNoteClick) {
      onNoteClick(noteId);
    } else {
      router.push(`/notes/${noteId}`);
    }
  };

  const updateNoteMutation = useUpdateNote();
  const updateFolderMutation = useUpdateFolder();

  const updateNoteFolder = async (noteId: string, folderId: string | null) => {
    await updateNoteMutation.mutateAsync({
      id: noteId,
      updates: { folder_id: folderId },
      silent: false,
    });
  };

  const updateFolderParent = async (folderId: string, parentId: string | null) => {
    await updateFolderMutation.mutateAsync({
      id: folderId,
      updates: { parent_id: parentId },
    });
  };

  const { activeId, activeType, handleDragStart, handleDragEnd } = useNoteDragAndDrop({
    updateNoteFolder,
    updateFolderParent,
    folderTree: folderTree || [],
  });

  // Find the active note or folder being dragged for the overlay
  const activeNote = useMemo((): Note | null => {
    if (!activeId || activeType === 'folder') return null;
    const note = notesWithoutFolder?.find((n) => n.id === activeId);
    if (note) return note;
    // Search in folder tree
    const findNoteInTree = (folders: typeof folderTree): Note | null => {
      if (!folders) return null;
      for (const folder of folders) {
        const found = folder.notes.find((n) => n.id === activeId);
        if (found) return found;
        const foundInChildren = findNoteInTree(folder.children);
        if (foundInChildren) return foundInChildren;
      }
      return null;
    };
    return findNoteInTree(folderTree || []);
  }, [activeId, activeType, notesWithoutFolder, folderTree]);

  const activeFolder = useMemo((): FolderTreeItem | null => {
    if (!activeId || activeType !== 'folder') return null;
    const folderId = activeId.replace('folder-', '');
    // Search in folder tree
    const findFolderInTree = (folders: typeof folderTree): FolderTreeItem | null => {
      if (!folders) return null;
      for (const folder of folders) {
        if (folder.id === folderId) return folder;
        const foundInChildren = findFolderInTree(folder.children);
        if (foundInChildren) return foundInChildren;
      }
      return null;
    };
    return findFolderInTree(folderTree || []);
  }, [activeId, activeType, folderTree]);

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

  // Search mode: show flat search results
  if (isSearching) {
    return (
      <NotesSearchResults
        notes={searchResults ?? []}
        searchQuery={searchQuery}
        onNoteClick={onNoteClick}
        onProjectClick={onProjectClick}
        projects={projects}
      />
    );
  }

  if (!hasFolders && !hasNotesWithoutFolder) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium mb-2">No folders or notes yet</p>
        <p className="text-sm">Create a folder or note to get started</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-1">
        {/* Notes without folders */}
        {hasNotesWithoutFolder && (
          <div className="mb-4">
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              No Folder
            </div>
            <DroppableNoFolder>
              {notesWithoutFolder.map((note) => {
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
                    indent={8}
                  />
                );
              })}
            </DroppableNoFolder>
          </div>
        )}

        {/* Folders */}
        {hasFolders && (
          <>
            {hasNotesWithoutFolder && (
              <div className="border-t my-2" />
            )}
            {folderTree.map((folder) => (
              <FolderTreeNode
                key={folder.id}
                folder={folder}
                level={0}
                onNoteClick={onNoteClick}
                onProjectClick={onProjectClick}
                projects={projects}
              />
            ))}
          </>
        )}
      </div>
      <DragOverlay>
        {activeNote ? (
          <div className="flex items-center gap-2 py-1 px-2 rounded-md bg-background border shadow-lg text-sm opacity-90">
            <span className="flex-1 truncate">{activeNote.title}</span>
          </div>
        ) : activeFolder ? (
          <div className="flex items-center gap-2 py-1 px-2 rounded-md bg-background border shadow-lg text-sm opacity-90">
            <span className="flex-1 truncate">{activeFolder.name}</span>
            {(activeFolder.notes.length > 0 || activeFolder.children.length > 0) && (
              <span className="text-xs text-muted-foreground">
                {activeFolder.notes.length + activeFolder.children.length}
              </span>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
