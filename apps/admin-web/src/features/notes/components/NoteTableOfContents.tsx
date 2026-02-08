'use client';

import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { cn } from '@/shared/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@altitutor/ui';

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

/**
 * Table of Contents component that extracts headings from the editor
 * and displays them as a navigable list.
 */
export function NoteTableOfContents({ editor, className, collapsible = false }: NoteTableOfContentsProps) {
  const [tocItems, setTocItems] = useState<TocItem[]>([]);

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
      editor.commands.setTextSelection(targetPos);
      editor.commands.scrollIntoView();
    }
  };

  if (tocItems.length === 0) {
    return null;
  }

  const content = (
    <TocNavigation items={tocItems} editor={editor} onItemClick={scrollToHeading} />
  );

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
    <div className={cn('bg-card rounded-lg p-6 border', className)}>
      <h3 className="text-sm font-semibold mb-3 text-foreground">Table of Contents</h3>
      {content}
    </div>
  );
}
