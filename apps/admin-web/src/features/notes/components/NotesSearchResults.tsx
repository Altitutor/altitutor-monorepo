'use client';

import { useMemo } from 'react';
import { usePaneNavigation } from '@/shared/hooks/usePaneNavigation';
import { FileText, FolderKanban } from 'lucide-react';
import { cn } from '@/shared/utils';
import { navLinkInactiveStyles } from '@altitutor/ui';
import { proseMirrorToPlainText } from '../utils/rich-text';
import { highlightSearchTerms, getSearchTerms } from '../utils/highlight';
import type { Note } from '../types';
import { defaultDocumentOrder, sortDocuments, type DocumentOrder } from '../utils/documentOrder';

const CONTENT_SNIPPET_LENGTH = 120;

interface NotesSearchResultsProps {
  notes: Note[];
  searchQuery: string;
  order?: DocumentOrder;
  onNoteClick?: (noteId: string) => void;
  onProjectClick?: (projectId: string) => void;
  projects?: Array<{ id: string; name: string | null }>;
}

function sortNotesByRelevance(notes: Note[], searchQuery: string, order: DocumentOrder): Note[] {
  const sorted = sortDocuments(notes, order);
  const terms = getSearchTerms(searchQuery).map((term) => term.toLowerCase());
  if (order.field !== "title" || terms.length === 0) return sorted;

  const titleMatches = (note: Note) => terms.some((term) => (note.title ?? "").toLowerCase().includes(term));
  return [...sorted.filter(titleMatches), ...sorted.filter((note) => !titleMatches(note))];
}

/**
 * Displays search results with highlighted matches in title and content snippet
 */
export function NotesSearchResults({ notes, searchQuery, order = defaultDocumentOrder, onNoteClick, onProjectClick, projects = [] }: NotesSearchResultsProps) {
  const { router } = usePaneNavigation();
  const sortedNotes = useMemo(() => sortNotesByRelevance(notes, searchQuery, order), [notes, searchQuery, order]);

  const handleNoteClick = (noteId: string) => {
    if (onNoteClick) {
      onNoteClick(noteId);
    } else {
      router.push(`/documents/${noteId}`);
    }
  };

  if (notes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium mb-2">No documents found</p>
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
              'w-full text-left flex items-start gap-2 py-2 px-2 rounded-md cursor-pointer',
              'group',
              navLinkInactiveStyles
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
