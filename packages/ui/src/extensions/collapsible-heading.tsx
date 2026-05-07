'use client';

import { Heading } from '@tiptap/extension-heading';
import { mergeAttributes, type Editor, type NodeViewProps } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { cn } from '../lib/cn';

const foldPluginKey = new PluginKey<DecorationSet>('collapsibleHeadingFold');

/** Block spacing moved from `h*` to the wrapper so the gutter row shares the same box as the title. */
const HEADING_WRAP_SPACING: Record<number, string> = {
  1: 'mt-7 mb-1.5',
  2: 'mt-6 mb-1',
  3: 'mt-5 mb-1',
  4: 'mt-4 mb-1',
  5: 'mt-4 mb-1',
  6: 'mt-4 mb-1',
};

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;

function CollapsibleHeadingView(props: NodeViewProps) {
  const { node, editor, updateAttributes, HTMLAttributes } = props;
  const level = Math.min(6, Math.max(1, Number(node.attrs.level) || 1)) as 1 | 2 | 3 | 4 | 5 | 6;
  const Tag = HEADING_TAGS[level - 1];
  const collapsed = Boolean(node.attrs.collapsed);

  const attrs = HTMLAttributes as { class?: string; className?: string };
  const mergedHeadingClass = cn(
    'min-w-0 w-full !mt-0 !mb-0',
    attrs.className,
    attrs.class
  );

  const wrapSpacing = HEADING_WRAP_SPACING[level];

  return (
    <NodeViewWrapper
      className={cn(
        'tiptap-heading-block min-w-0',
        wrapSpacing,
        editor.isEditable &&
          'grid w-[calc(100%+1.5rem)] max-w-none -ml-6 grid-cols-[minmax(1.5rem,1.5rem)_minmax(0,1fr)] items-start gap-0'
      )}
    >
      {editor.isEditable ? (
        <div
          className="tiptap-heading-gutter flex min-h-0 w-full min-w-0 shrink-0 justify-center pt-[0.2em]"
        >
          <button
            type="button"
            contentEditable={false}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              updateAttributes({ collapsed: !collapsed });
              editor.view.focus();
            }}
            className="tiptap-heading-fold-toggle inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            aria-expanded={!collapsed}
            aria-label="Toggle section"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden={true}
              className="transition-transform duration-150 ease-out"
              style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      ) : null}
      <NodeViewContent
        as={(Tag as unknown) as 'div'}
        {...HTMLAttributes}
        className={mergedHeadingClass}
      />
    </NodeViewWrapper>
  );
}

function getFoldSpan(
  doc: PMNode,
  headingPos: number,
  headingNode: PMNode
): { hideFrom: number; hideTo: number } | null {
  const $h = doc.resolve(headingPos);
  const after = $h.nodeAfter;
  if (!after || after.type.name !== 'heading') {
    return null;
  }

  const parent = $h.node($h.depth);
  const headingIndex = $h.index($h.depth);
  const headingLevel = headingNode.attrs.level as number;

  let hideFrom = headingPos + after.nodeSize;
  let hideTo = hideFrom;

  for (let i = headingIndex + 1; i < parent.childCount; i += 1) {
    const child = parent.child(i);
    if (child.type.name === 'heading' && (child.attrs.level as number) <= headingLevel) {
      break;
    }
    hideTo += child.nodeSize;
  }

  if (hideTo <= hideFrom) return null;
  return { hideFrom, hideTo };
}

function buildFoldDecorations(doc: PMNode, editor: Editor | null): DecorationSet {
  if (!editor?.isEditable) {
    return DecorationSet.empty;
  }

  const decos: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') {
      return true;
    }

    if (!node.attrs.collapsed) {
      return true;
    }

    const span = getFoldSpan(doc, pos, node);
    if (span) {
      let offset = span.hideFrom;
      while (offset < span.hideTo) {
        const child = doc.nodeAt(offset);
        if (!child) break;
        const end = offset + child.nodeSize;
        decos.push(
          Decoration.node(offset, end, {
            class: 'tiptap-heading-fold-hidden',
            style: 'display:none',
          })
        );
        offset = end;
      }
    }

    return true;
  });

  return DecorationSet.create(doc, decos);
}

/**
 * Heading with optional `collapsed` attribute, an inline gutter chevron (editable mode),
 * and folded siblings hidden until the next heading of equal or higher level.
 * TipTap has no built-in equivalent; {@link https://tiptap.dev/docs/editor/extensions/nodes/details | Details}
 * is the closest stock collapsible block.
 */
export const CollapsibleHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      collapsed: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-heading-collapsed') === 'true',
        renderHTML: (attributes) => {
          if (!attributes.collapsed) {
            return {};
          }
          return { 'data-heading-collapsed': 'true' };
        },
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const hasLevel = this.options.levels.includes(node.attrs.level);
    const level = hasLevel ? node.attrs.level : this.options.levels[0];
    return [
      `h${level}`,
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CollapsibleHeadingView);
  },

  addProseMirrorPlugins() {
    const getEditor = (): Editor | null => this.editor ?? null;

    return [
      new Plugin({
        key: foldPluginKey,
        state: {
          init: (_, { doc }) => buildFoldDecorations(doc, getEditor()),
          apply: (tr, old, _oldState, newState) => {
            if (!tr.docChanged) {
              return old.map(tr.mapping, newState.doc);
            }
            return buildFoldDecorations(newState.doc, getEditor());
          },
        },
        props: {
          decorations(state) {
            return foldPluginKey.getState(state);
          },
        },
      }),
    ];
  },
});
