'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { Mathematics } from '@tiptap/extension-mathematics';
import { TableKit } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Typography from '@tiptap/extension-typography';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import Image from '@tiptap/extension-image';
import { TextSelection, NodeSelection } from '@tiptap/pm/state';
import {
  CellSelection,
  deleteColumn,
  deleteRow,
  deleteTable,
} from '@tiptap/pm/tables';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import { ImageUploadPlaceholderExtension } from './rich-text-editor-image-upload-placeholder';
import { CollapsibleHeading } from '../extensions/collapsible-heading';
import { ExternalVideoExtension } from '../extensions/external-video';
import { ImageSelectionHighlight } from '../extensions/image-selection-highlight';
import { SlashCommandExtension } from '../extensions/slash-command';
import { OMIT_TYPOGRAPHY_HEADING_CLASSNAME } from './rich-text-editor-styles';
import { RichTextEditorBottomToolbar } from './rich-text-editor-bottom-toolbar';
import type { JSONContent } from '@tiptap/core';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/cn';
import { shouldPreferMarkdownPaste } from '../lib/markdown-paste';
import { transformPastedHtmlForBulkImport } from '../lib/sanitize-pasted-html';
import '../styles/prosemirror-tables.css';
import 'katex/dist/katex.min.css';

const UPLOAD_PLACEHOLDER_PREFIX = '__UPLOAD_';
const UPLOAD_PLACEHOLDER_SUFFIX = '__';

/**
 * Extracts image files from pasted HTML (data: and blob: URLs) and returns
 * files in order plus HTML with those srcs replaced by __UPLOAD_0__, __UPLOAD_1__, etc.
 */
async function extractImagesFromPastedHtml(
  html: string
): Promise<{ files: File[]; htmlWithPlaceholders: string }> {
  const files: File[] = [];
  // Match img src="data:..." or src="blob:..." or src='...' (single/double quote, non-greedy).
  const imgSrcRegex =
    /<img[\s\S]*?src\s*=\s*["']((?:data:|blob:)[^"']+)["'][\s\S]*?>/gi;
  const matches = [...html.matchAll(imgSrcRegex)];
  if (matches.length === 0) {
    return { files, htmlWithPlaceholders: html };
  }

  let htmlWithPlaceholders = html;
  for (let i = 0; i < matches.length; i += 1) {
    const fullMatch = matches[i][0];
    const src = matches[i][1];
    const placeholder = `${UPLOAD_PLACEHOLDER_PREFIX}${i}${UPLOAD_PLACEHOLDER_SUFFIX}`;
    let file: File | null = null;

    if (src.startsWith('data:')) {
      const commaIdx = src.indexOf(',');
      if (commaIdx === -1) continue;
      const header = src.slice(0, commaIdx);
      const base64 = src.slice(commaIdx + 1);
      const mimeMatch = header.match(/data:([^;]+)/);
      const mime = mimeMatch ? mimeMatch[1].trim() : 'image/png';
      try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let j = 0; j < binary.length; j += 1) bytes[j] = binary.charCodeAt(j);
        const blob = new Blob([bytes], { type: mime });
        file = new File([blob], `pasted-${i}.${mime.split('/')[1] || 'png'}`, {
          type: mime,
        });
      } catch {
        continue;
      }
    } else if (src.startsWith('blob:')) {
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        const mime = blob.type || 'image/png';
        file = new File([blob], `pasted-${i}.${mime.split('/')[1] || 'png'}`, {
          type: mime,
        });
      } catch {
        continue;
      }
    }

    if (file) {
      files.push(file);
      htmlWithPlaceholders = htmlWithPlaceholders.replace(fullMatch, (tag) =>
        tag.replace(src, placeholder)
      );
    }
  }

  return { files, htmlWithPlaceholders };
}

export type { JSONContent };
export { PLACEHOLDER_NODE_NAME } from './rich-text-editor-image-upload-placeholder';

export interface RichTextEditorRef {
  focusToEnd: () => void;
  getEditor: () => Editor | null;
}

export interface MentionClickDetail {
  id: string;
  type: string;
  label: string;
}

export interface RichTextEditorProps {
  /**
   * Content can be a JSON object (preferred), a JSON string, or a Markdown string.
   */
  content: JSONContent | string | null | undefined;
  /**
   * Callback when content changes. Returns the JSON structure.
   */
  onChange?: (json: JSONContent) => void;
  /**
   * When > 0, calls `onChange` only after the editor has been idle for this many milliseconds.
   * Fewer React / react-hook-form updates while typing (recommended for large TipTap documents).
   */
  onChangeDebounceMs?: number;
  /**
   * Optional callback for markdown output if needed.
   */
  onMarkdownChange?: (markdown: string) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onEditorReady?: (editor: Editor) => void;
  /**
   * If true, uses markdown as the source of truth for the initial content.
   */
  isMarkdown?: boolean;
  /**
   * Minimum height of the editor.
   */
  minHeight?: string;
  /**
   * When true, the editor sizes to its content instead of stretching to fill the parent.
   */
  autoHeight?: boolean;
  /**
   * Whether the editor is editable.
   */
  editable?: boolean;
  /**
   * Optional configuration for mentions.
   * If provided, typing @ will trigger the mention suggestions.
   */
  mentionSuggestions?: Omit<SuggestionOptions, 'editor'>;
  /**
   * When returning true, the default `mentionClick` window event is not dispatched.
   * Use for context-specific navigation (e.g. document links in dialogs vs full page).
   */
  onMentionClick?: (detail: MentionClickDetail) => boolean;
  /**
   * Optional callback when image file(s) are pasted from the clipboard.
   * When set, paste events that contain image files (or HTML with embedded data/blob images) call this.
   * Use for uploading and inserting images at the cursor (e.g. from Google Docs, Word, PDF).
   * When pasted HTML contains embedded images, `options.pastedHtml` is the HTML with image srcs
   * replaced by placeholders __UPLOAD_0__, __UPLOAD_1__, etc.; replace with uploaded URLs in order.
   */
  onPasteImages?: (
    editor: Editor,
    files: File[],
    options?: { pastedHtml?: string }
  ) => void;
  /**
   * When true, pasting plain text that contains newlines inserts one paragraph per line
   * instead of a single paragraph. Use for content where line breaks must be preserved (e.g. bulk import).
   */
  pastePlainTextAsParagraphs?: boolean;
  /**
   * When set, controls how pasted table content is handled. Overrides pastePlainTextAsParagraphs when both apply.
   * - strip_all: Convert to plain text, one paragraph per line (tables and formatting removed).
   * - strip_outside: Flatten top-level tables only; nested tables inside cells are preserved.
   * - keep: Preserve all HTML including tables.
   */
  pasteTableBehavior?: 'strip_all' | 'strip_outside' | 'keep';
  /**
   * When true, pasted HTML is sanitized before insert: keeps bold, italic, paragraphs, and tables;
   * strips font size, color, highlight, and other styling. Respects {@link pasteTableBehavior}.
   */
  pasteStripFormatting?: boolean;
  /**
   * Additional TipTap extensions to add to the editor (e.g. JumpHighlightExtension for note TOC).
   */
  extensions?: import('@tiptap/core').AnyExtension[];
  /**
   * When true, omit Tailwind Typography `prose` on the editor root so inline ProseMirror
   * decorations (e.g. background colors on spans) are not overridden by typography defaults.
   */
  omitTypography?: boolean;
  /**
   * Optional configuration for slash commands (triggered by typing "/").
   * When provided, typing "/" opens a menu with formatting options and optionally templates.
   */
  slashMenuSuggestions?: Omit<
    import('@tiptap/suggestion').SuggestionOptions,
    'editor' | 'char'
  >;
  /**
   * Enables collapsible heading node views with gutter chevrons.
   * Keep this off for normal rich text fields; enable only for document editors.
   */
  enableCollapsibleHeadings?: boolean;
  /** Show a contextual toolbar while the editor has focus, including table controls. */
  floatingToolbar?: boolean;
}

const BLOCK_TAGS = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI'];

/**
 * Convert HTML to plain text with structure preserved: each table cell and each block element
 * becomes its own line, so line breaks are retained (one paragraph per line for strip_all).
 */
function htmlToPlainTextWithStructure(html: string): string {
  if (!html.trim()) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;
    const lines: string[] = [];

    function getText(el: Node): string {
      return (el as HTMLElement).textContent?.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim() ?? '';
    }

    function processNode(node: Node): void {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.tagName === 'TABLE') {
          if ((el.parentElement as Element)?.closest?.('table')) return;
          const rows = el.querySelectorAll(':scope > tbody > tr, :scope > tr');
          for (const row of rows) {
            const cells = row.querySelectorAll(':scope > td, :scope > th');
            for (const cell of cells) {
              const text = getText(cell);
              if (text) lines.push(text);
            }
          }
          return;
        }
        if (el.tagName === 'BR') {
          lines.push('');
          return;
        }
        if (BLOCK_TAGS.includes(el.tagName)) {
          const hasBlockOrTableChild = Array.from(el.children).some(
            (c) => c.tagName === 'TABLE' || BLOCK_TAGS.includes(c.tagName)
          );
          if (hasBlockOrTableChild) {
            for (const child of el.childNodes) processNode(child);
          } else {
            const text = getText(el);
            if (text) lines.push(text);
          }
          return;
        }
      }
      for (const child of Array.from(node.childNodes)) {
        processNode(child);
      }
    }

    for (const child of Array.from(body.childNodes)) {
      processNode(child);
    }
    return lines.join('\n');
  } catch {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

function applyPasteHtmlTransforms(
  html: string,
  options: {
    pasteTableBehavior?: 'strip_all' | 'strip_outside' | 'keep';
    pasteStripFormatting?: boolean;
  }
): string {
  if (options.pasteStripFormatting) {
    return transformPastedHtmlForBulkImport(html, {
      pasteTableBehavior: options.pasteTableBehavior,
    });
  }
  let result = html;
  if (options.pasteTableBehavior === 'strip_outside') {
    result = stripOuterTablesFromHtml(result);
  }
  return result;
}

function collectClipboardImageFiles(event: ClipboardEvent): File[] {
  const items = event.clipboardData?.items;
  if (!items) return [];
  const files: File[] = [];
  for (const item of Array.from(items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files;
}

function hasEmbeddablePastedImages(html: string): boolean {
  return /<img[\s\S]*?src\s*=\s*["']?(data:|blob:)/i.test(html);
}

/** Images are configured as block nodes, so lift pasted images out of paragraphs before TipTap parses them. */
function liftPastedImagesOutOfParagraphs(html: string): string {
  if (!/<img\b/i.test(html)) return html;
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const images = Array.from(doc.body.querySelectorAll('p img'));
    for (const image of images) {
      const paragraph = image.closest('p');
      const parent = paragraph?.parentNode;
      if (!paragraph || !parent) continue;

      const trailingParagraph = paragraph.cloneNode(false) as HTMLParagraphElement;
      while (image.nextSibling) {
        trailingParagraph.appendChild(image.nextSibling);
      }
      image.remove();
      parent.insertBefore(image, paragraph.nextSibling);
      if (trailingParagraph.hasChildNodes()) {
        parent.insertBefore(trailingParagraph, image.nextSibling);
      }
      if (!paragraph.hasChildNodes()) {
        paragraph.remove();
      }
    }
    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

type PasteHtmlInsertOptions = {
  pasteTableBehavior?: 'strip_all' | 'strip_outside' | 'keep';
  pasteStripFormatting?: boolean;
  onPasteImages?: RichTextEditorProps['onPasteImages'];
};

async function preparePastedHtmlForInsert(
  pastedHtml: string,
  options: PasteHtmlInsertOptions
): Promise<{ html: string; imageFiles: File[] }> {
  let htmlToTransform = pastedHtml;
  let imageFiles: File[] = [];

  if (options.onPasteImages && hasEmbeddablePastedImages(pastedHtml)) {
    const extracted = await extractImagesFromPastedHtml(pastedHtml);
    if (extracted.files.length > 0) {
      imageFiles = extracted.files;
      htmlToTransform = extracted.htmlWithPlaceholders;
    }
  }

  const html = liftPastedImagesOutOfParagraphs(applyPasteHtmlTransforms(htmlToTransform, {
    pasteTableBehavior: options.pasteTableBehavior,
    pasteStripFormatting: options.pasteStripFormatting,
  }));

  return { html, imageFiles };
}

function insertPastedHtmlWithOptionalImages(
  editor: Editor,
  pastedHtml: string,
  options: PasteHtmlInsertOptions
): void {
  void preparePastedHtmlForInsert(pastedHtml, options)
    .then(({ html, imageFiles }) => {
      if (!editor || editor.isDestroyed) return;
      if (imageFiles.length > 0 && options.onPasteImages) {
        options.onPasteImages(editor, imageFiles, { pastedHtml: html });
        return;
      }
      editor.chain().deleteSelection().insertContent(html).focus().run();
    })
    .catch(() => {
      if (!editor || editor.isDestroyed) return;
      const fallback = applyPasteHtmlTransforms(pastedHtml, {
        pasteTableBehavior: options.pasteTableBehavior,
        pasteStripFormatting: options.pasteStripFormatting,
      });
      editor.chain().deleteSelection().insertContent(fallback).focus().run();
    });
}

/** Replace top-level tables (not nested inside another table) with divs containing each cell's innerHTML; nested tables are preserved. */
function stripOuterTablesFromHtml(html: string): string {
  if (!html.trim()) return html;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;
    const tables = body.querySelectorAll('table');
    for (const table of tables) {
      if ((table.parentElement as Element)?.closest?.('table')) continue;
      const fragment = doc.createDocumentFragment();
      const rows = table.querySelectorAll(':scope > tbody > tr, :scope > tr');
      for (const row of rows) {
        const cells = row.querySelectorAll(':scope > td, :scope > th');
        for (const cell of cells) {
          const content = (cell as HTMLElement).innerHTML.trim();
          if (content) {
            const div = doc.createElement('div');
            div.innerHTML = content;
            fragment.appendChild(div);
          }
        }
      }
      table.replaceWith(fragment);
    }
    return body.innerHTML;
  } catch {
    return html;
  }
}

/**
 * Shared Tiptap Rich Text Editor component.
 * Standardized for JSONB storage but maintains compatibility with Markdown.
 */
export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(({
  content,
  onChange,
  onMarkdownChange,
  className,
  placeholder = 'Start writing...',
  autoFocus = false,
  onEditorReady,
  isMarkdown = false,
  minHeight = '200px',
  autoHeight = false,
  editable = true,
  mentionSuggestions,
  onMentionClick,
  onPasteImages,
  pastePlainTextAsParagraphs = false,
  pasteTableBehavior,
  pasteStripFormatting = false,
  extensions: extraExtensions,
  omitTypography = false,
  slashMenuSuggestions,
  onChangeDebounceMs,
  enableCollapsibleHeadings = false,
  floatingToolbar = false,
}, ref) => {
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [floatingToolbarStyle, setFloatingToolbarStyle] = useState<React.CSSProperties | null>(null);
  // Tracks the last value emitted to avoid unnecessary re-renders/content resets
  const lastEmittedJsonRef = useRef<string>('');
  const lastEmittedMarkdownRef = useRef<string>('');
  const debounceMsRef = useRef(0);
  debounceMsRef.current = onChangeDebounceMs ?? 0;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDebouncedJsonRef = useRef<JSONContent | null>(null);
  /** Skips prop-sync effect when RHF passes the same object reference (debounced `onChange`). */
  const lastContentPropRef = useRef(content);

  // Refs for callbacks to avoid closure staleness without re-creating editor
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onMarkdownChangeRef = useRef(onMarkdownChange);
  onMarkdownChangeRef.current = onMarkdownChange;
  const onMentionClickRef = useRef(onMentionClick);
  onMentionClickRef.current = onMentionClick;

  // Capture-phase clipboard read: when pasting table (or other content), clipboardData can be
  // empty in the bubble-phase paste handler. Reading in capture phase gives us the data first.
  const clipboardCaptureRef = useRef<{ text: string; html: string } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: enableCollapsibleHeadings ? false : { levels: [1, 2, 3, 4, 5, 6] },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
        link: {
          openOnClick: false,
          HTMLAttributes: {
            class: 'text-primary underline cursor-pointer',
          },
        },
      }),
      ...(enableCollapsibleHeadings
        ? [
            CollapsibleHeading.configure({
              levels: [1, 2, 3, 4, 5, 6],
            }),
          ]
        : []),
      Markdown.configure({
        markedOptions: {
          gfm: true,
        },
      }),
      Mathematics.configure({
        katexOptions: {
          throwOnError: false,
          strict: 'warn',
        },
      }),
      TableKit.configure({
        table: {
          resizable: true,
        },
      }),
      TextStyleKit.configure({
        // Generic text style support
      } as Record<string, unknown>),
      Typography,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
        showOnlyCurrent: false,
        showOnlyWhenEditable: true,
        includeChildren: true,
      }),
      Details.configure({
        persist: true,
        openClassName: 'is-open',
        HTMLAttributes: {
          class: 'my-3 rounded-lg border border-border bg-card/50 p-0 overflow-hidden not-prose',
        },
      }),
      DetailsSummary,
      DetailsContent,
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            fileId: {
              default: null,
              parseHTML: (el) => el.getAttribute('data-file-id'),
              renderHTML: (attrs) =>
                attrs.fileId ? { 'data-file-id': attrs.fileId } : {},
            },
            storageBucket: {
              default: null,
              parseHTML: (el) => el.getAttribute('data-storage-bucket'),
              renderHTML: (attrs) =>
                attrs.storageBucket ? { 'data-storage-bucket': attrs.storageBucket } : {},
            },
            storagePath: {
              default: null,
              parseHTML: (el) => el.getAttribute('data-storage-path'),
              renderHTML: (attrs) =>
                attrs.storagePath ? { 'data-storage-path': attrs.storagePath } : {},
            },
            visualType: {
              default: null,
              parseHTML: (el) => el.getAttribute('data-visual-type'),
              renderHTML: (attrs) =>
                attrs.visualType ? { 'data-visual-type': attrs.visualType } : {},
            },
            visualSpec: {
              default: null,
              parseHTML: (el) => {
                const value = el.getAttribute('data-visual-spec')
                if (!value) return null
                try {
                  return JSON.parse(value)
                } catch {
                  return null
                }
              },
              // The source spec is persisted in TipTap JSON. Avoid duplicating a potentially
              // large JSON object into rendered HTML; visualType is enough for DOM affordances.
              renderHTML: () => ({}),
            },
            visualTitle: {
              default: null,
              parseHTML: (el) => el.getAttribute('data-visual-title'),
              renderHTML: () => ({}),
            },
            visualAltText: {
              default: null,
              parseHTML: (el) => el.getAttribute('data-visual-alt-text'),
              renderHTML: () => ({}),
            },
            visualVersion: {
              default: null,
              parseHTML: (el) => {
                const value = Number(el.getAttribute('data-visual-version'))
                return Number.isFinite(value) ? value : null
              },
              renderHTML: () => ({}),
            },
          };
        },
        addNodeView() {
          const parent = this.parent?.();
          if (!parent) {
            return null;
          }
          return (props) => {
            const nodeView = parent(props);
            if (!nodeView) {
              return nodeView;
            }
            const dom = nodeView.dom as HTMLElement;
            const img =
              dom instanceof HTMLImageElement
                ? dom
                : dom.querySelector('img');
            if (img instanceof HTMLImageElement) {
              const reveal = () => {
                dom.style.visibility = '';
                dom.style.pointerEvents = '';
              };
              const bindRevealOnLoad = (image: HTMLImageElement) => {
                // TipTap resize hides the container until onload; also reveal on error so
                // expired signed URLs do not leave invisible placeholder-sized boxes.
                if (image.complete) {
                  reveal();
                  return;
                }
                image.addEventListener('load', reveal, { once: true });
                image.addEventListener('error', reveal, { once: true });
              };
              bindRevealOnLoad(img);

              const parentUpdate = nodeView.update?.bind(nodeView);
              if (parentUpdate) {
                nodeView.update = (node, decorations, innerDecorations) => {
                  const result = parentUpdate(node, decorations, innerDecorations);
                  if (result === false) {
                    return false;
                  }
                  const nextSrc = node.attrs.src;
                  if (
                    typeof nextSrc === 'string' &&
                    nextSrc.length > 0 &&
                    img.getAttribute('src') !== nextSrc
                  ) {
                    dom.style.visibility = 'hidden';
                    dom.style.pointerEvents = 'none';
                    img.src = nextSrc;
                    bindRevealOnLoad(img);
                  }
                  return result;
                };
              }
            }
            return nodeView;
          };
        },
      }).configure({
        inline: false,
        allowBase64: false,
        resize: {
          enabled: true,
          directions: [
            'top',
            'bottom',
            'left',
            'right',
            'top-left',
            'top-right',
            'bottom-left',
            'bottom-right',
          ],
          minWidth: 50,
          minHeight: 50,
          alwaysPreserveAspectRatio: true,
        },
        HTMLAttributes: {
          class: 'my-3 rounded-md max-w-full h-auto cursor-pointer',
        },
      }),
      ImageSelectionHighlight,
      ImageUploadPlaceholderExtension,
      ExternalVideoExtension,
      ...(slashMenuSuggestions
        ? [
            SlashCommandExtension.configure({
              suggestion: slashMenuSuggestions,
            }),
          ]
        : []),
      ...(mentionSuggestions ? [
        Mention.configure({
          HTMLAttributes: {
            class: 'bg-primary/10 text-primary px-1 rounded-sm font-medium cursor-pointer transition-colors hover:bg-primary/20',
            'data-mention': 'true',
          },
          suggestion: {
            ...mentionSuggestions,
          },
        }).extend({
          addAttributes() {
            return {
              ...this.parent?.(),
              id: {
                default: null,
                parseHTML: element => element.getAttribute('data-id'),
                renderHTML: attributes => ({
                  'data-id': attributes.id,
                }),
              },
              label: {
                default: null,
                parseHTML: element => element.getAttribute('data-label') || element.innerText,
                renderHTML: attributes => ({
                  'data-label': attributes.label,
                }),
              },
              type: {
                default: null,
                parseHTML: element => element.getAttribute('data-type'),
                renderHTML: attributes => ({
                  'data-type': attributes.type,
                }),
              },
            }
          },
        })
      ] : []),
      ...(extraExtensions || []),
    ],
    content: (() => {
      if (!content) return { type: 'doc', content: [{ type: 'paragraph' }] };
      
      if (typeof content === 'string') {
        if (isMarkdown) return content; // Tiptap handles markdown string if extension is loaded
        
        try {
          return JSON.parse(content);
        } catch {
          // Fallback to treat as markdown if JSON parsing fails but isMarkdown wasn't set
          return content;
        }
      }
      
      return content;
    })(),
    editable,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      handleKeyDown: (view, event) => {
        const { state } = view;
        const { selection } = state;

        // Full row/column cell selections: Delete/Backspace removes the row/column
        // (default table editing only clears cell contents).
        if (
          (event.key === 'Backspace' || event.key === 'Delete') &&
          selection instanceof CellSelection
        ) {
          const isRow = selection.isRowSelection();
          const isCol = selection.isColSelection();
          if (isRow && isCol) {
            if (deleteTable(state, view.dispatch)) {
              event.preventDefault();
              return true;
            }
          } else if (isRow) {
            if (deleteRow(state, view.dispatch)) {
              event.preventDefault();
              return true;
            }
          } else if (isCol) {
            if (deleteColumn(state, view.dispatch)) {
              event.preventDefault();
              return true;
            }
          }
        }

        if (!(selection instanceof NodeSelection)) return false;
        if (selection.node.type.name !== 'image') return false;

        const posAfter = selection.$to.pos;

        if (
          event.key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          event.preventDefault();
          const tr = state.tr
            .setSelection(TextSelection.near(state.doc.resolve(posAfter), 1))
            .insertText(event.key);
          view.dispatch(tr);
          return true;
        }

        if (event.key === 'Backspace' || event.key === 'Delete') {
          event.preventDefault();
          const tr = state.tr.deleteSelection();
          view.dispatch(tr);
          return true;
        }

        return false;
      },
      handleClick: (view, _pos, event) => {
        const target = event.target as HTMLElement;
        const mentionNode = target.closest('[data-mention]') as HTMLElement | null;
        if (mentionNode) {
          const id = mentionNode.getAttribute('data-id');
          const type = mentionNode.getAttribute('data-type');
          const label = mentionNode.innerText;
          
          if (id && type) {
            const detail = { id, type, label };
            const handled = onMentionClickRef.current?.(detail) ?? false;
            if (!handled) {
              window.dispatchEvent(
                new CustomEvent<MentionClickDetail>('mentionClick', { detail })
              );
            }
            return true;
          }
        }

        const { state } = view;
        const docSize = state.doc.content.size;
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        
        if (coords && coords.pos >= docSize) {
          const transaction = state.tr.setSelection(
            TextSelection.near(state.doc.resolve(docSize))
          );
          view.dispatch(transaction);
          view.focus();
          return true;
        }
        return false;
      },
      attributes: {
        class: cn(
          omitTypography
            ? [
                /* Inherit parent color so white UCAT exam chrome stays readable in dark mode */
                'max-w-none focus:outline-none text-inherit text-sm not-prose',
                /* These classes are on view.dom (.ProseMirror), so target its heading children directly. */
                OMIT_TYPOGRAPHY_HEADING_CLASSNAME,
                '[&_.ProseMirror_p]:my-2 [&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ol]:my-2',
                '[&_.ProseMirror_li]:my-1',
                '[&_.ProseMirror_li_ol]:mt-2 [&_.ProseMirror_li_ul]:mt-2',
                /* Tables: className is on view.dom (.ProseMirror) — use [&_table]/[&_td], not nested [&_.ProseMirror_table] */
                '[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-visible',
                '[&_th]:border [&_th]:border-solid [&_th]:border-border [&_th]:bg-muted [&_th]:p-2 [&_th]:text-left',
                '[&_td]:border [&_td]:border-solid [&_td]:border-border [&_td]:p-2 [&_td]:align-top',
                '[&_details]:my-4 [&_details]:rounded-lg [&_details]:border [&_details]:border-border [&_details]:bg-card/40',
                '[&_summary]:cursor-pointer [&_summary]:list-none [&_summary]:px-3 [&_summary]:py-2 [&_summary]:font-semibold [&_summary]:outline-none',
                '[&_.details-content]:border-t [&_.details-content]:border-border [&_.details-content]:px-3 [&_.details-content]:pb-3 [&_.details-content]:pt-2',
              ]
            : [
                'prose prose-sm dark:prose-invert max-w-none focus:outline-none',
                'prose-headings:font-semibold prose-headings:tracking-tight',
                'prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg',
                'prose-h1:mt-7 prose-h1:mb-1.5 prose-h2:mt-6 prose-h2:mb-1 prose-h3:mt-5 prose-h3:mb-1',
                'prose-p:my-2 prose-ul:my-2 prose-ol:my-2',
                'prose-li:my-1',
                'prose-ol:list-decimal prose-ul:list-disc prose-li:list-item',
                'prose-table:my-4 prose-th:border prose-th:border-border prose-th:p-2 prose-th:bg-muted',
                'prose-td:border prose-td:border-border prose-td:p-2',
                '[&_details]:my-4 [&_details]:rounded-lg [&_details]:border [&_details]:border-border [&_details]:bg-card/40',
                '[&_summary]:cursor-pointer [&_summary]:list-none [&_summary]:px-3 [&_summary]:py-2 [&_summary]:font-semibold [&_summary]:outline-none',
                '[&_.details-content]:border-t [&_.details-content]:border-border [&_.details-content]:px-3 [&_.details-content]:pb-3 [&_.details-content]:pt-2',
              ],
          '[&_.ProseMirror]:cursor-text',
          '[&_.ProseMirror]:pl-6',
          /* Preflight clears list markers; [&_ol]/[&_ul] target view.dom children (tiptap/ProseMirror root) */
          '[&_ol]:list-decimal [&_ol]:pl-[1.625em] [&_ol]:[list-style-position:outside]',
          '[&_ul]:list-disc [&_ul]:pl-[1.625em] [&_ul]:[list-style-position:outside]',
          omitTypography
            ? '[&_li]:list-item [&_li]:marker:text-inherit'
            : '[&_li]:list-item [&_li]:marker:text-foreground',
          '[&_p.is-empty.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
          '[&_p.is-empty.is-editor-empty:first-child::before]:text-muted-foreground',
          '[&_p.is-empty.is-editor-empty:first-child::before]:float-left',
          '[&_p.is-empty.is-editor-empty:first-child::before]:h-0',
          '[&_p.is-empty.is-editor-empty:first-child::before]:pointer-events-none',
          '[&_p.is-empty.is-editor-empty:first-child::before]:!opacity-100',
          '[&_p.is-empty.is-editor-empty:first-child::before]:!visible',
          '[&_.ProseMirror_ul>li>p:empty]:min-h-[1.5em]',
          '[&_.ProseMirror_ol>li>p:empty]:min-h-[1.5em]',
          className
        ),
        'data-placeholder': placeholder,
      },
      handlePaste: (view, event) => {
        let pastedText = event.clipboardData?.getData('text/plain') ?? '';
        let pastedHtml = event.clipboardData?.getData('text/html') ?? '';

        // Markdown source paste (e.g. from Cursor/VS Code `.md` files): TipTap's Markdown
        // extension does not parse clipboard text unless contentType is 'markdown'. Without
        // this, `#` / `**` land as literal characters (often with syntax-highlight spans).
        const hasSpecialPasteMode =
          Boolean(pasteTableBehavior) || pastePlainTextAsParagraphs || pasteStripFormatting;
        if (
          editor &&
          !hasSpecialPasteMode &&
          pastedText &&
          shouldPreferMarkdownPaste(pastedText, pastedHtml)
        ) {
          const imageFiles = collectClipboardImageFiles(event);
          if (imageFiles.length === 0) {
            event.preventDefault();
            editor
              .chain()
              .focus()
              .deleteSelection()
              .insertContent(pastedText, { contentType: 'markdown' })
              .run();
            return true;
          }
        }

        if (pastedText === '' && pastedHtml === '' && clipboardCaptureRef.current) {
          const captured = clipboardCaptureRef.current;
          clipboardCaptureRef.current = null;
          pastedText = captured.text;
          pastedHtml = captured.html;
          const behaviorFromCapture =
            pasteTableBehavior ?? (pastePlainTextAsParagraphs ? 'strip_all' : null);
          if ((pastedText || pastedHtml) && editor && behaviorFromCapture) {
            event.preventDefault();
            const behavior = behaviorFromCapture;
            const text = pastedHtml ? htmlToPlainTextWithStructure(pastedHtml) : pastedText;
            const lines = text.split(/\r?\n/);
            if (behavior === 'strip_all' && pasteStripFormatting && pastedHtml) {
              insertPastedHtmlWithOptionalImages(editor, pastedHtml, {
                pasteTableBehavior: 'strip_all',
                pasteStripFormatting: true,
                onPasteImages,
              });
            } else if (behavior === 'strip_all' && (lines.length > 1 || !pastedHtml)) {
              const content = lines.map((line) => ({
                type: 'paragraph',
                content: line.length > 0 ? [{ type: 'text', text: line }] : [],
              }));
              const pos = editor.state.selection.from;
              editor.chain().deleteSelection().insertContentAt(pos, content).focus().run();
            } else if (behavior === 'strip_outside' && pastedHtml) {
              insertPastedHtmlWithOptionalImages(editor, pastedHtml, {
                pasteTableBehavior: behavior,
                pasteStripFormatting,
                onPasteImages,
              });
            } else if (behavior === 'keep' && pastedHtml) {
              insertPastedHtmlWithOptionalImages(editor, pastedHtml, {
                pasteTableBehavior: behavior,
                pasteStripFormatting,
                onPasteImages,
              });
            } else if (behavior === 'strip_outside' || behavior === 'keep') {
              editor.chain().deleteSelection().insertContent(pastedText).focus().run();
            } else {
              const content = lines.map((line) => ({
                type: 'paragraph',
                content: line.length > 0 ? [{ type: 'text', text: line }] : [],
              }));
              const pos = editor.state.selection.from;
              editor.chain().deleteSelection().insertContentAt(pos, content).focus().run();
            }
            return true;
          }
        }

        // Fallback when paste event (and capture) had no clipboardData: try async Clipboard API.
        if (
          pastedText === '' &&
          pastedHtml === '' &&
          editor &&
          typeof navigator?.clipboard?.read === 'function' &&
          (pasteTableBehavior || pastePlainTextAsParagraphs)
        ) {
          event.preventDefault();
          const behavior =
            pasteTableBehavior ?? (pastePlainTextAsParagraphs ? 'strip_all' : null);
          navigator.clipboard.read().then((clipboardItems) => {
            const htmlItem = clipboardItems.find((i) => i.types.includes('text/html'));
            const textItem = clipboardItems.find((i) => i.types.includes('text/plain'));
            const getHtml = htmlItem ? htmlItem.getType('text/html').then((b) => b.text()) : Promise.resolve('');
            const getText = textItem ? textItem.getType('text/plain').then((b) => b.text()) : Promise.resolve('');
            Promise.all([getHtml, getText]).then(([html, text]) => {
              if (!editor || editor.isDestroyed) return;
              const h = html ?? '';
              const t = text ?? '';
              const resolvedText = h ? htmlToPlainTextWithStructure(h) : t;
              const lines = resolvedText.split(/\r?\n/);
              if (behavior === 'strip_all' && pasteStripFormatting && h) {
                insertPastedHtmlWithOptionalImages(editor, h, {
                  pasteTableBehavior: 'strip_all',
                  pasteStripFormatting: true,
                  onPasteImages,
                });
              } else if (behavior === 'strip_all') {
                const content = lines.map((line) => ({
                  type: 'paragraph',
                  content: line.length > 0 ? [{ type: 'text', text: line }] : [],
                }));
                const pos = editor.state.selection.from;
                editor.chain().deleteSelection().insertContentAt(pos, content).focus().run();
              } else if (behavior === 'strip_outside' && h) {
                insertPastedHtmlWithOptionalImages(editor, h, {
                  pasteTableBehavior: behavior,
                  pasteStripFormatting,
                  onPasteImages,
                });
              } else if (behavior === 'keep' && h) {
                insertPastedHtmlWithOptionalImages(editor, h, {
                  pasteTableBehavior: behavior,
                  pasteStripFormatting,
                  onPasteImages,
                });
              } else {
                editor.chain().deleteSelection().insertContent(t || resolvedText).focus().run();
              }
            }).catch(() => {});
          }).catch(() => {});
          return true;
        }

        // Apply pasteTableBehavior or pastePlainTextAsParagraphs when we have data.
        const behavior = pasteTableBehavior ?? (pastePlainTextAsParagraphs ? 'strip_all' : null);
        if (behavior && (pastedText || pastedHtml) && editor) {
          event.preventDefault();

          // strip_all: plain text when no HTML; otherwise sanitize and drop tables.
          if (behavior === 'strip_all') {
            if (pasteStripFormatting && pastedHtml) {
              insertPastedHtmlWithOptionalImages(editor, pastedHtml, {
                pasteTableBehavior: 'strip_all',
                pasteStripFormatting: true,
                onPasteImages,
              });
              return true;
            }
            const text = pastedHtml ? htmlToPlainTextWithStructure(pastedHtml) : pastedText;
            const lines = text.split(/\r?\n/);
            const content = lines.map((line) => ({
              type: 'paragraph',
              content: line.length > 0 ? [{ type: 'text', text: line }] : [],
            }));
            const pos = editor.state.selection.from;
            editor.chain().deleteSelection().insertContentAt(pos, content).focus().run();
            return true;
          }

          // strip_outside / keep: preserve HTML (with tables optionally flattened) and still
          // allow image uploads for embedded data/blob images when onPasteImages is provided.
          if (pastedHtml) {
            insertPastedHtmlWithOptionalImages(editor, pastedHtml, {
              pasteTableBehavior: behavior,
              pasteStripFormatting,
              onPasteImages,
            });
          } else {
            // No HTML, fall back to treating text as paragraphs.
            const text = pastedText;
            const lines = text.split(/\r?\n/);
            const content = lines.map((line) => ({
              type: 'paragraph',
              content: line.length > 0 ? [{ type: 'text', text: line }] : [],
            }));
            const pos = editor.state.selection.from;
            editor.chain().deleteSelection().insertContentAt(pos, content).focus().run();
          }
          return true;
        }

        if (pasteStripFormatting && pastedHtml && editor && !behavior) {
          event.preventDefault();
          insertPastedHtmlWithOptionalImages(editor, pastedHtml, {
            pasteStripFormatting: true,
            onPasteImages,
          });
          return true;
        }

        // If clipboard contains image files and we have an image paste handler, handle it first.
        const items = event.clipboardData?.items;
        if (items && onPasteImages && editor) {
          const files = collectClipboardImageFiles(event);
          if (files.length > 0) {
            event.preventDefault();
            onPasteImages(editor, files);
            return true;
          }

          // No image files: check for HTML with embedded images (e.g. paste from Word/Google Docs).
          const html = event.clipboardData?.getData('text/html');
          if (html && hasEmbeddablePastedImages(html)) {
            event.preventDefault();
            insertPastedHtmlWithOptionalImages(editor, html, {
              pasteTableBehavior: behavior ?? undefined,
              pasteStripFormatting,
              onPasteImages,
            });
            return true;
          }
        }

        if (!mentionSuggestions) return false;

        if (!pastedText) return false;

        const mentionType = view.state.schema.nodes.mention;
        if (!mentionType) return false;

        // Parse tag markers: @[type:id:displayText]
        const markerRegex = /@\[([^:\]]+):([^:\]]+):(.+?)\]/g;
        const hasMarker = markerRegex.test(pastedText);
        markerRegex.lastIndex = 0;
        if (!hasMarker) return false;

        event.preventDefault();

        const { state } = view;
        let tr = state.tr.deleteSelection();
        let insertPos = tr.selection.from;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = markerRegex.exec(pastedText)) !== null) {
          const [fullMatch, type, id, label] = match;

          // Insert plain text before marker
          const beforeText = pastedText.slice(lastIndex, match.index);
          if (beforeText) {
            tr = tr.insertText(beforeText, insertPos);
            insertPos += beforeText.length;
          }

          // Insert mention node
          const mentionNode = mentionType.create({ id, label, type });
          tr = tr.insert(insertPos, mentionNode);
          insertPos += mentionNode.nodeSize;

          lastIndex = match.index + fullMatch.length;
        }

        // Insert trailing plain text
        const trailingText = pastedText.slice(lastIndex);
        if (trailingText) {
          tr = tr.insertText(trailingText, insertPos);
          insertPos += trailingText.length;
        }

        tr = tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(insertPos, tr.doc.content.size))));
        view.dispatch(tr);
        view.focus();
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      if (!editor) return;

      const json = editor.getJSON();
      const jsonString = JSON.stringify(json);
      const debounceMs = debounceMsRef.current;

      if (debounceMs > 0 && onChangeRef.current) {
        pendingDebouncedJsonRef.current = json;
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          if (!editor || editor.isDestroyed) return;
          const pending = pendingDebouncedJsonRef.current;
          if (!pending) return;
          const s = JSON.stringify(pending);
          if (s === lastEmittedJsonRef.current) return;
          lastEmittedJsonRef.current = s;
          onChangeRef.current?.(pending);
          if (onMarkdownChangeRef.current) {
            const markdown = editor.getMarkdown();
            if (markdown !== lastEmittedMarkdownRef.current) {
              lastEmittedMarkdownRef.current = markdown;
              onMarkdownChangeRef.current(markdown);
            }
          }
        }, debounceMs);
      } else if (jsonString !== lastEmittedJsonRef.current) {
        lastEmittedJsonRef.current = jsonString;
        onChangeRef.current?.(json);
      }

      if (debounceMs === 0 && onMarkdownChangeRef.current) {
        const markdown = editor.getMarkdown();
        if (markdown !== lastEmittedMarkdownRef.current) {
          lastEmittedMarkdownRef.current = markdown;
          onMarkdownChangeRef.current(markdown);
        }
      }
    },
  });

  // Sync content updates
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const incomingContent = content;

    if (typeof incomingContent !== 'string' && incomingContent === lastContentPropRef.current) {
      return;
    }

    let isEcho = false;

    if (typeof incomingContent === 'string') {
      if (isMarkdown) {
        isEcho = incomingContent === lastEmittedMarkdownRef.current;
      } else {
        isEcho = incomingContent === lastEmittedJsonRef.current;
      }
    } else {
      isEcho = JSON.stringify(incomingContent) === lastEmittedJsonRef.current;
    }

    if (isEcho) {
      lastContentPropRef.current = incomingContent;
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingDebouncedJsonRef.current = null;

    const parsedContent = (() => {
      if (!incomingContent) return { type: 'doc', content: [{ type: 'paragraph' }] };
      if (typeof incomingContent === 'string' && !isMarkdown) {
        try {
          return JSON.parse(incomingContent);
        } catch {
          return incomingContent;
        }
      }
      return incomingContent;
    })();

    // Prop-driven sync must not emit onUpdate — that re-enters RHF onChange and can
    // infinite-loop when a parent mirrors form state back into `content`.
    editor.commands.setContent(parsedContent as JSONContent | string, {
      contentType: isMarkdown ? 'markdown' : undefined,
      emitUpdate: false,
    });

    lastContentPropRef.current = incomingContent;
    if (!isMarkdown) {
      lastEmittedJsonRef.current = JSON.stringify(editor.getJSON());
    } else {
      lastEmittedMarkdownRef.current = editor.getMarkdown();
    }
  }, [content, editor, isMarkdown]);

  // Flush debounced onChange so navigations / saves don't drop the last edits.
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const pending = pendingDebouncedJsonRef.current;
      if (pending && onChangeRef.current) {
        const s = JSON.stringify(pending);
        if (s !== lastEmittedJsonRef.current) {
          lastEmittedJsonRef.current = s;
          onChangeRef.current(pending);
        }
      }
      pendingDebouncedJsonRef.current = null;
    };
  }, []);

  // Sync editability
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && editor && !editor.isDestroyed) {
      const timeoutId = setTimeout(() => {
        if (editor && !editor.isDestroyed) {
          editor.commands.focus();
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [autoFocus, editor]);

  // Notify ready
  useEffect(() => {
    if (editor && !editor.isDestroyed && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor || !floatingToolbar) return;

    const handleFocus = () => setIsEditorFocused(true);
    const handleBlur = () => setIsEditorFocused(false);

    editor.on('focus', handleFocus);
    editor.on('blur', handleBlur);
    setIsEditorFocused(editor.isFocused);

    return () => {
      editor.off('focus', handleFocus);
      editor.off('blur', handleBlur);
    };
  }, [editor, floatingToolbar]);

  useEffect(() => {
    if (!floatingToolbar || !isEditorFocused) {
      setFloatingToolbarStyle(null);
      return;
    }

    const toolbarContainer = editorContainerRef.current?.closest<HTMLElement>(
      '[data-rich-text-toolbar-container]'
    );
    if (!toolbarContainer) return;

    const updatePosition = () => {
      const rect = toolbarContainer.getBoundingClientRect();
      const inset = 12;
      setFloatingToolbarStyle({
        position: 'fixed',
        zIndex: 70,
        left: rect.left + inset,
        width: Math.max(0, rect.width - inset * 2),
        bottom: Math.max(inset, window.innerHeight - rect.bottom + inset),
      });
    };

    updatePosition();
    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(toolbarContainer);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [floatingToolbar, isEditorFocused]);

  useImperativeHandle(ref, () => ({
    focusToEnd: () => {
      if (!editor || editor.isDestroyed) return;
      const { state } = editor.view;
      const docSize = state.doc.content.size;
      const transaction = state.tr.setSelection(
        TextSelection.near(state.doc.resolve(docSize))
      );
      editor.view.dispatch(transaction);
      editor.commands.focus();
    },
    getEditor: () => editor,
  }), [editor]);

  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!editor || editor.isDestroyed || !editable) return;

    const editorElement = editor.view.dom;
    const editorRect = editorElement.getBoundingClientRect();
    const clickX = e.clientX;
    const clickY = e.clientY;

    if (clickX < editorRect.left || clickX > editorRect.right || clickY < editorRect.top || clickY > editorRect.bottom) {
      e.preventDefault();
      e.stopPropagation();

      let targetY = clickY;
      if (clickY < editorRect.top) targetY = editorRect.top;
      else if (clickY > editorRect.bottom) targetY = editorRect.bottom;

      const coords = editor.view.posAtCoords({ left: editorRect.left + (editorRect.width / 2), top: targetY });
      if (coords) {
        const { state } = editor.view;
        const transaction = state.tr.setSelection(
          TextSelection.near(state.doc.resolve(coords.pos))
        );
        editor.view.dispatch(transaction);
        editor.commands.focus();
      }
    }
  }, [editor, editable]);

  if (!editor) {
    return <div className="text-muted-foreground animate-pulse p-4">Loading editor...</div>;
  }

  return (
    <div
      ref={editorContainerRef}
      className={cn(
        'relative flex w-full min-w-0 cursor-text flex-col overflow-visible',
        autoHeight ? 'h-auto' : 'h-full min-h-0',
        !editable && 'cursor-default'
      )}
      style={autoHeight ? undefined : { minHeight }}
      onClick={handleContainerClick}
      onPasteCapture={(e) => {
        clipboardCaptureRef.current = {
          text: e.clipboardData?.getData?.('text/plain') ?? '',
          html: e.clipboardData?.getData?.('text/html') ?? '',
        };
      }}
    >
      <EditorContent
        editor={editor}
        className={cn(autoHeight ? 'h-auto overflow-visible' : 'min-h-0 flex-1 overflow-visible')}
      />
      {floatingToolbar && isEditorFocused && floatingToolbarStyle && createPortal(
        <div className="pointer-events-none" style={floatingToolbarStyle}>
          <div className="pointer-events-auto">
            <RichTextEditorBottomToolbar editor={editor} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';
