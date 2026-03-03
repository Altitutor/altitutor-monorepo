'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Search } from 'lucide-react';
import { cn } from '@/shared/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Input } from '@altitutor/ui';
import { highlightSearchTerms } from '../utils/highlight';
import { JUMP_HIGHLIGHT_META } from '../extensions/JumpHighlightExtension';

interface TocItem {
  id: string;
  level: number;
  text: string;
  number: string;
}

interface SearchResult {
  pos: number;
  matchLength: number;
  snippet: string;
  isTitleMatch: boolean;
}

interface NoteTableOfContentsProps {
  editor: Editor | null;
  title?: string;
  className?: string;
  collapsible?: boolean;
}

/**
 * Internal component that renders the TOC navigation items
 */
function TocNavigation({ items, editor: _editor, onItemClick }: { items: TocItem[]; editor: Editor | null; onItemClick: (id: string) => void }) {
  return (
    <nav className="space-y-1">
      {items.map((item, index) => (
        <button
          key={`${item.id}-${index}`}
          onClick={() => onItemClick(item.id)}
          className={cn(
            'block w-full text-left text-sm hover:text-primary transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded',
            item.level === 1 && 'font-semibold',
            item.level === 2 && 'pl-4',
            item.level === 3 && 'pl-8',
            item.level === 4 && 'pl-12',
            item.level === 5 && 'pl-16',
            item.level === 6 && 'pl-20'
          )}
          style={{ fontSize: item.level === 1 ? '0.875rem' : '0.8125rem' }}
        >
          <span className="text-muted-foreground mr-2">{item.number}.</span>
          {item.text}
        </button>
      ))}
    </nav>
  );
}

const SNIPPET_RADIUS = 60;

/**
 * Trigger temporary highlight via ProseMirror decorations (heading or search match).
 * Uses a transaction meta key so the JumpHighlightExtension plugin can add decorations.
 */
function triggerJumpHighlight(editor: Editor, pos: number, length: number, isBlock: boolean): void {
  const { view, state } = editor;
  const tr = state.tr.setMeta(JUMP_HIGHLIGHT_META, { pos, length, isBlock });
  view.dispatch(tr);
}

/**
 * Temporarily highlight a heading element.
 * Uses view.nodeDOM(pos) to get the DOM node for the document node at pos (the heading).
 */
function highlightHeading(editor: Editor, pos: number): void {
  const { state } = editor;
  const $pos = state.doc.resolve(pos);
  const node = $pos.nodeAfter;
  if (!node || node.type.name !== 'heading') return;
  const nodeSize = node.nodeSize;
  triggerJumpHighlight(editor, pos, nodeSize, true);
}

/**
 * Temporarily highlight matched text at position
 * Uses ProseMirror decorations so the highlight survives ProseMirror DOM updates.
 */
function highlightMatchedText(editor: Editor, pos: number, matchLength: number): void {
  triggerJumpHighlight(editor, pos, matchLength, false);
}

/**
 * Extract text segments with positions from ProseMirror doc for search
 */
function getTextSegments(doc: { descendants: (fn: (node: { isText: boolean; text?: string }, pos: number) => void) => void }): { pos: number; text: string }[] {
  const segments: { pos: number; text: string }[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      segments.push({ pos, text: node.text });
    }
  });
  return segments;
}

/**
 * Search document and return results with position and snippet
 */
function searchInDocument(
  segments: { pos: number; text: string }[],
  title: string,
  query: string
): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchResult[] = [];
  const fullParts: string[] = [];
  const partPositions: { pos: number; start: number; end: number }[] = [];

  // Title as first segment (scroll to 0 when clicked)
  const titleText = (title || '') + '\n\n';
  fullParts.push(titleText);
  partPositions.push({ pos: 0, start: 0, end: titleText.length });

  let offset = titleText.length;
  for (const seg of segments) {
    fullParts.push(seg.text);
    partPositions.push({ pos: seg.pos, start: offset, end: offset + seg.text.length });
    offset += seg.text.length;
  }

  const fullText = fullParts.join('');
  const regex = new RegExp(escapeForRegex(q), 'gi');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(fullText)) !== null) {
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;

    // Find which segment contains this match
    const part = partPositions.find((p) => matchStart >= p.start && matchEnd <= p.end);
    if (!part) continue;

    const snippetStart = Math.max(0, matchStart - SNIPPET_RADIUS);
    const snippetEnd = Math.min(fullText.length, matchEnd + SNIPPET_RADIUS);
    let snippet = fullText.slice(snippetStart, snippetEnd).replace(/\s+/g, ' ');
    if (snippetStart > 0) snippet = '…' + snippet;
    if (snippetEnd < fullText.length) snippet = snippet + '…';

    const posInSegment = matchStart - part.start;
    const scrollPos = part.pos + posInSegment;
    const isTitleMatch = part.pos === 0 && part.start === 0;

    results.push({ pos: scrollPos, matchLength: match[0].length, snippet, isTitleMatch });
  }

  return results;
}

function escapeForRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Table of Contents component that extracts headings from the editor
 * and displays them as a navigable list.
 */
export function NoteTableOfContents({ editor, title = '', className, collapsible = false }: NoteTableOfContentsProps) {
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!editor) {
      setTocItems([]);
      return;
    }

    const updateToc = () => {
      const headings: TocItem[] = [];
      const doc = editor.state.doc;
      const counters = [0, 0, 0, 0, 0, 0]; // Counters for levels 1-6

      doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const level = node.attrs.level as number;
          const text = node.textContent.trim();
          
          if (text) {
            // Increment counter for this level
            counters[level - 1]++;
            
            // Reset counters for deeper levels
            for (let i = level; i < 6; i++) {
              counters[i] = 0;
            }
            
            // Generate number string (e.g., "1", "1.0.1", "1.2.3")
            // Always include all levels up to current heading, filling missing levels with 0
            const numberParts: number[] = [];
            for (let i = 0; i < level; i++) {
              numberParts.push(counters[i] || 0);
            }
            const number = numberParts.join('.');
            
            // Generate a simple ID from the heading text
            const id = `heading-${pos}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            headings.push({ id, level, text, number });
          }
        }
      });

      setTocItems(headings);
    };

    // Initial update
    updateToc();

    // Update on editor changes
    const handleUpdate = () => {
      updateToc();
    };

    editor.on('update', handleUpdate);
    editor.on('selectionUpdate', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
      editor.off('selectionUpdate', handleUpdate);
    };
  }, [editor]);

  const scrollToHeading = (id: string) => {
    if (!editor) return;

    const doc = editor.state.doc;
    let targetPos: number | null = null;

    doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        const text = node.textContent.trim();
        const nodeId = `heading-${pos}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

        if (nodeId === id) {
          targetPos = pos;
          return false; // Stop searching
        }
      }
    });

    if (targetPos !== null) {
      editor.commands.focus(targetPos, { scrollIntoView: true });
      highlightHeading(editor, targetPos);
    }
  };

  const scrollToPosition = (pos: number, matchLength: number, isTitleMatch: boolean) => {
    if (!editor) return;
    editor.commands.focus(pos, { scrollIntoView: true });
    if (!isTitleMatch) {
      highlightMatchedText(editor, pos, matchLength);
    }
  };

  const searchResults = useMemo(() => {
    if (!editor) return [];
    const segments = getTextSegments(editor.state.doc);
    return searchInDocument(segments, title, searchQuery);
    // We intentionally depend on editor.state.doc to recompute when the document changes,
    // even though the editor instance is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, editor?.state.doc, title, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  const searchInput = (
    <div className="relative mb-3">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search in note..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="pl-8 h-8 text-sm"
      />
    </div>
  );

  const searchResultsContent = isSearching && (
    <div className="space-y-1 mb-4 min-w-0 overflow-hidden">
      {searchResults.length > 0 ? (
        searchResults.map((result, i) => (
          <button
            key={`${result.pos}-${i}`}
            type="button"
            onClick={() => scrollToPosition(result.pos, result.matchLength, result.isTitleMatch)}
            className="block w-full min-w-0 text-left text-sm p-2 rounded-md hover:bg-muted/50 transition-colors text-foreground overflow-hidden"
          >
            <span className="line-clamp-2 break-words">{highlightSearchTerms(result.snippet, searchQuery)}</span>
          </button>
        ))
      ) : (
        <p className="text-sm text-muted-foreground py-2">No matches found</p>
      )}
    </div>
  );

  const tocContent = tocItems.length > 0 ? (
    <TocNavigation items={tocItems} editor={editor} onItemClick={scrollToHeading} />
  ) : (
    <p className="text-sm text-muted-foreground">No headings yet</p>
  );

  const content = (
    <>
      {searchInput}
      {searchResultsContent}
      {!isSearching && tocContent}
    </>
  );

  // Always show on mobile (collapsible), hide on desktop if empty
  if (tocItems.length === 0 && !collapsible && !isSearching) {
    return null;
  }

  if (collapsible) {
    return (
      <Accordion type="single" collapsible className={cn('bg-card rounded-lg border', className)}>
        <AccordionItem value="toc" className="border-none">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <h3 className="text-sm font-semibold text-foreground">Table of Contents</h3>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-4">
            {content}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="text-sm font-semibold text-foreground">Table of Contents</h3>
      {content}
    </div>
  );
}
