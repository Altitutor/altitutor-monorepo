'use client';

import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  navLinkActiveStyles,
  navLinkInactiveStyles,
} from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { JUMP_HIGHLIGHT_META } from '../extensions/JumpHighlightExtension';

interface TocItem {
  id: string;
  level: number;
  text: string;
  number: string;
}

interface NoteTableOfContentsProps {
  editor: Editor | null;
  className?: string;
  collapsible?: boolean;
  /** When true, omit the section heading and always render (parent card supplies the title). */
  embedded?: boolean;
}

/**
 * Outline rows styled like the documents list (compact row + translucent hover/selected).
 */
function TocNavigation({
  items,
  activeId,
  onItemClick,
}: {
  items: TocItem[];
  activeId: string | null;
  onItemClick: (id: string) => void;
}) {
  return (
    <nav className="space-y-0.5">
      {items.map((item, index) => {
        const isActive = activeId === item.id;
        return (
          <button
            key={`${item.id}-${index}`}
            type="button"
            onClick={() => onItemClick(item.id)}
            style={{ paddingLeft: `${8 + (item.level - 1) * 12}px` }}
            className={cn(
              'group flex w-full items-center gap-2 py-1 pr-2 rounded-md text-sm text-left',
              isActive ? navLinkActiveStyles : navLinkInactiveStyles
            )}
          >
            <span className="w-8 shrink-0 tabular-nums text-xs text-muted-foreground">
              {item.number}
            </span>
            <span className="min-w-0 flex-1 truncate">{item.text}</span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * Trigger temporary highlight via ProseMirror decorations.
 * Uses a transaction meta key so the JumpHighlightExtension plugin can add decorations.
 */
function triggerJumpHighlight(editor: Editor, pos: number, length: number, isBlock: boolean): void {
  const { view, state } = editor;
  const tr = state.tr.setMeta(JUMP_HIGHLIGHT_META, { pos, length, isBlock });
  view.dispatch(tr);
}

/**
 * Temporarily highlight a heading element.
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
 * Table of Contents component that extracts headings from the editor
 * and displays them as a navigable list.
 */
export function NoteTableOfContents({
  editor,
  className,
  collapsible = false,
  embedded = false,
}: NoteTableOfContentsProps) {
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!editor) {
      setTocItems([]);
      return;
    }

    const updateToc = () => {
      const headings: TocItem[] = [];
      const doc = editor.state.doc;
      const counters = [0, 0, 0, 0, 0, 0];

      doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const level = node.attrs.level as number;
          const text = node.textContent.trim();

          if (text) {
            counters[level - 1]++;

            for (let i = level; i < 6; i++) {
              counters[i] = 0;
            }

            const numberParts: number[] = [];
            for (let i = 0; i < level; i++) {
              numberParts.push(counters[i] || 0);
            }
            const number = numberParts.join('.');

            const id = `heading-${pos}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            headings.push({ id, level, text, number });
          }
        }
      });

      setTocItems(headings);
    };

    updateToc();

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
    setActiveId(id);

    const doc = editor.state.doc;
    let targetPos: number | null = null;

    doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        const text = node.textContent.trim();
        const nodeId = `heading-${pos}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

        if (nodeId === id) {
          targetPos = pos;
          return false;
        }
      }
    });

    if (targetPos !== null) {
      editor.commands.focus(targetPos, { scrollIntoView: true });
      highlightHeading(editor, targetPos);
    }
  };

  const tocContent =
    tocItems.length > 0 ? (
      <TocNavigation items={tocItems} activeId={activeId} onItemClick={scrollToHeading} />
    ) : (
      <p className="text-sm text-muted-foreground px-2">No headings yet</p>
    );

  if (tocItems.length === 0 && !collapsible && !embedded) {
    return null;
  }

  if (collapsible) {
    return (
      <Accordion type="single" collapsible className={cn('bg-card rounded-lg border', className)}>
        <AccordionItem value="toc" className="border-none">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <h3 className="text-sm font-semibold text-foreground">Table of Contents</h3>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-4">{tocContent}</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  if (embedded) {
    return <div className={cn(className)}>{tocContent}</div>;
  }

  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="text-sm font-semibold text-foreground">Table of Contents</h3>
      {tocContent}
    </div>
  );
}
