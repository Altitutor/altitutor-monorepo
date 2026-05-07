'use client';

import { useMemo } from 'react';
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { SlashCommandList, type SlashCommandItem } from '@/shared/components/SlashCommandList';
import type { SlashCommandListRef } from '@/shared/components/SlashCommandList';
import { useRichTextTemplates } from '@/features/rich-text-templates/api/templates';
import { extractTextFromNoteContent } from '@/shared/utils/noteContentUtils';
import type { Json } from '@altitutor/shared';
import type { JSONContent } from '@tiptap/core';
import type { Tables } from '@altitutor/shared';

/**
 * Extracts content nodes to insert from TipTap doc format.
 */
function getContentToInsert(
  templateContent: JSONContent | Record<string, unknown> | null
): JSONContent[] {
  if (!templateContent) return [];

  const content = (templateContent as { content?: JSONContent[] }).content;
  if (Array.isArray(content) && content.length > 0) {
    return content;
  }

  const asNode = templateContent as JSONContent;
  if (asNode.type === 'doc' && Array.isArray(asNode.content)) {
    return asNode.content;
  }

  return [asNode];
}

/**
 * Hook to provide slash command suggestions for the RichTextEditor.
 * Includes formatting commands (headings, lists, etc.) and searchable templates.
 */
export function useSlashCommandSuggestions() {
  const { data: templates = [] } = useRichTextTemplates();

  return useMemo(() => {
    const baseItems: SlashCommandItem[] = [
      {
        title: 'Heading 1',
        subtext: 'Large section heading',
        group: 'Formatting',
        keywords: ['h1', 'heading', 'title'],
        onSelect: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
        },
      },
      {
        title: 'Heading 2',
        subtext: 'Medium section heading',
        group: 'Formatting',
        keywords: ['h2', 'heading', 'subtitle'],
        onSelect: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
        },
      },
      {
        title: 'Heading 3',
        subtext: 'Small section heading',
        group: 'Formatting',
        keywords: ['h3', 'heading'],
        onSelect: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
        },
      },
      {
        title: 'Bullet list',
        subtext: 'Create a bulleted list',
        group: 'Lists',
        keywords: ['ul', 'unordered', 'bullets'],
        onSelect: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
      },
      {
        title: 'Numbered list',
        subtext: 'Create a numbered list',
        group: 'Lists',
        keywords: ['ol', 'ordered', 'numbers'],
        onSelect: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
      },
      {
        title: 'Collapsible section',
        subtext: 'Toggle hidden body content (TipTap details — like Notion toggle)',
        group: 'Blocks',
        keywords: ['toggle', 'fold', 'collapse', 'details', 'heading'],
        onSelect: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setDetails().run();
        },
      },
      {
        title: 'Quote',
        subtext: 'Insert a blockquote',
        group: 'Blocks',
        keywords: ['blockquote', 'citation'],
        onSelect: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        },
      },
      {
        title: 'Code block',
        subtext: 'Insert a code block',
        group: 'Blocks',
        keywords: ['code', 'pre', 'preformatted'],
        onSelect: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
      },
      {
        title: 'Table',
        subtext: 'Insert a table',
        group: 'Insert',
        keywords: ['grid', 'rows', 'columns'],
        onSelect: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run();
        },
      },
      {
        title: 'Divider',
        subtext: 'Insert a horizontal rule',
        group: 'Insert',
        keywords: ['hr', 'separator', 'line'],
        onSelect: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHorizontalRule().run();
        },
      },
    ];

    const templateItems: SlashCommandItem[] = (templates as Tables<'rich_text_templates'>[]).map(
      (template) => ({
        title: template.name,
        subtext: extractTextFromNoteContent(template.content as Json)?.slice(0, 50) || '(empty)',
        group: 'Templates',
        keywords: [template.name],
        onSelect: ({ editor, range }) => {
          const toInsert = getContentToInsert(template.content as JSONContent);
          if (toInsert.length > 0) {
            editor.chain().focus().deleteRange(range).insertContentAt(range.from, toInsert).run();
          }
        },
      })
    );

    const allItems = [...baseItems, ...templateItems];

    return {
      items: async ({ query }: { query: string }) => {
        const q = query.toLowerCase().trim();
        if (!q) return allItems;

        return allItems.filter((item) => {
          const titleMatch = item.title.toLowerCase().includes(q);
          const subtextMatch = item.subtext?.toLowerCase().includes(q);
          const keywordMatch = item.keywords?.some((k) => k.toLowerCase().includes(q));
          return titleMatch || subtextMatch || keywordMatch;
        });
      },

      command: ({ editor, range, props }: { editor: import('@tiptap/core').Editor; range: { from: number; to: number }; props: SlashCommandItem }) => {
        props.onSelect({ editor, range });
      },

      render: () => {
        let component: ReactRenderer<SlashCommandListRef> | undefined;
        let popup: TippyInstance[] | undefined;

        return {
          onStart: (props: SuggestionProps<SlashCommandItem>) => {
            component = new ReactRenderer(SlashCommandList, {
              props: {
                ...props,
                editor: props.editor,
                range: props.range,
              },
              editor: props.editor,
            });

            if (!props.clientRect) return;

            const getRect = () => props.clientRect?.() ?? new DOMRect(0, 0, 0, 0);
            popup = tippy('body', {
              getReferenceClientRect: getRect,
              appendTo: () => {
                const dialog = props.editor.view.dom.closest('[role="dialog"]');
                if (dialog) return dialog;
                return document.body;
              },
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: 'manual',
              placement: 'bottom-start',
            });
          },

          onUpdate(props: SuggestionProps<SlashCommandItem>) {
            if (!component) return;
            component.updateProps({
              ...props,
              editor: props.editor,
              range: props.range,
            });

            if (!props.clientRect || !popup?.[0]) return;

            const getRect = () => props.clientRect?.() ?? new DOMRect(0, 0, 0, 0);
            popup[0].setProps({ getReferenceClientRect: getRect });
          },

          onKeyDown(props: SuggestionKeyDownProps) {
            if (props.event.key === 'Escape') {
              if (popup?.[0]) {
                try {
                  popup[0].hide();
                } catch {
                  // Ignore if already destroyed
                }
              }
              return true;
            }
            return component?.ref?.onKeyDown(props) ?? false;
          },

          onExit() {
            if (popup?.[0]) {
              try {
                popup[0].destroy();
              } catch {
                // Ignore if already destroyed
              }
            }
            component?.destroy();
          },
        };
      },
    };
  }, [templates]);
}
