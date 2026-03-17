'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, FolderKanban } from 'lucide-react';
import { cn } from '@/shared/utils';
import { proseMirrorToPlainText } from '../utils/rich-text';
import { highlightSearchTerms, getSearchTerms } from '../utils/highlight';
import type { Note } from '../types';

const CONTENT_SNIPPET_LENGTH = 120;

interface NotesSearchResultsProps {
  notes: Note[];
  searchQuery: string;
  onNoteClick?: (noteId: string) => void;
  onProjectClick?: (projectId: string) => void;
  projects?: Array<{ id: string; name: string | null }>;
}

/** Sort notes: title matches first, then content-only matches, then alphabetically by title */
function sortNotesByRelevance(notes: Note[], searchQuery: string): Note[] {
  const terms = getSearchTerms(searchQuery).map((t) => t.toLowerCase());
  if (terms.length === 0) return [...notes].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));

  return [...notes].sort((a, b) => {
    const aTitle = (a.title ?? '').toLowerCase();
    const bTitle = (b.title ?? '').toLowerCase();
    const aTitleMatch = terms.some((t) => aTitle.includes(t));
    const bTitleMatch = terms.some((t) => bTitle.includes(t));

    if (aTitleMatch && !bTitleMatch) return -1;
    if (!aTitleMatch && bTitleMatch) return 1;
    return (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' });
  });
}

/**
 * Displays search results with highlighted matches in title and content snippet
 */
export function NotesSearchResults({ notes, searchQuery, onNoteClick, onProjectClick, projects = [] }: NotesSearchResultsProps) {
  const router = useRouter();
  const sortedNotes = useMemo(() => sortNotesByRelevance(notes, searchQuery), [notes, searchQuery]);

  const handleNoteClick = (noteId: string) => {
    if (onNoteClick) {
      onNoteClick(noteId);
    } else {
      router.push(`/notes/${noteId}`);
    }
  };

  if (notes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium mb-2">No notes found</p>
        <p className="text-sm">Try a different search term</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sortedNotes.map((note) => {
        const contentPlain = proseMirrorToPlainText(note.content);
        const snippet =
          contentPlain.length > CONTENT_SNIPPET_LENGTH
            ? contentPlain.slice(0, CONTENT_SNIPPET_LENGTH) + '…'
            : contentPlain;
        const project = note.project_id
          ? projects.find((p) => p.id === note.project_id)
          : null;

        return (
          <div
            key={note.id}
            role="button"
            tabIndex={0}
            onClick={() => handleNoteClick(note.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleNoteClick(note.id);
              }
            }}
            className={cn(
              'w-full text-left flex items-start gap-2 py-2 px-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer',
              'group'
            )}
          >
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {highlightSearchTerms(note.title ?? '', searchQuery)}
              </div>
              {snippet && (
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {highlightSearchTerms(snippet, searchQuery)}
                </div>
              )}
            </div>
            {project && onProjectClick && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onProjectClick(project.id);
                }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:bg-muted hover:text-foreground truncate max-w-[120px] flex-shrink-0"
                title={project.name ?? 'Project'}
              >
                <FolderKanban className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{project.name || 'Project'}</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
