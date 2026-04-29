'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Typography from '@tiptap/extension-typography';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';
import Image from '@tiptap/extension-image';
import { TextSelection, NodeSelection } from '@tiptap/pm/state';
import { ImageUploadPlaceholderExtension } from './rich-text-editor-image-upload-placeholder';
import { SlashCommandExtension } from '../extensions/slash-command';
import type { JSONContent } from '@tiptap/core';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { cn } from '../lib/cn';

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
   * Whether the editor is editable.
   */
  editable?: boolean;
  /**
   * Optional configuration for mentions.
   * If provided, typing @ will trigger the mention suggestions.
   */
  mentionSuggestions?: Omit<SuggestionOptions, 'editor'>;
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
  editable = true,
  mentionSuggestions,
  onPasteImages,
  pastePlainTextAsParagraphs = false,
  pasteTableBehavior,
  extensions: extraExtensions,
  omitTypography = false,
  slashMenuSuggestions,
}, ref) => {
  // Tracks the last value emitted to avoid unnecessary re-renders/content resets
  const lastEmittedJsonRef = useRef<string>('');
  const lastEmittedMarkdownRef = useRef<string>('');
  
  // Refs for callbacks to avoid closure staleness without re-creating editor
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onMarkdownChangeRef = useRef(onMarkdownChange);
  onMarkdownChangeRef.current = onMarkdownChange;

  // Capture-phase clipboard read: when pasting table (or other content), clipboardData can be
  // empty in the bubble-phase paste handler. Reading in capture phase gives us the data first.
  const clipboardCaptureRef = useRef<{ text: string; html: string } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Markdown.configure({
        markedOptions: {
          gfm: true,
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
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
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
      ImageUploadPlaceholderExtension,
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
    editorProps: {
      handleKeyDown: (view, event) => {
        const { state } = view;
        const { selection } = state;
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
            .setSelection(TextSelection.create(state.doc, posAfter))
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
            // Custom event for mention click
            const customEvent = new CustomEvent('mentionClick', { 
              detail: { id, type, label } 
            });
            window.dispatchEvent(customEvent);
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
                'max-w-none focus:outline-none text-foreground text-sm dark:text-foreground',
                '[&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h3]:text-lg',
                '[&_.ProseMirror_h1]:font-semibold [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:tracking-tight',
                '[&_.ProseMirror_h1]:mt-7 [&_.ProseMirror_h1]:mb-1.5 [&_.ProseMirror_h2]:mt-6 [&_.ProseMirror_h2]:mb-1 [&_.ProseMirror_h3]:mt-5 [&_.ProseMirror_h3]:mb-1',
                '[&_.ProseMirror_p]:my-2 [&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ol]:my-2',
                '[&_.ProseMirror_li]:my-1',
                /* Preflight clears list markers; prose normally restores them — mirror prose-sm lists */
                '[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-[1.625em]',
                '[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-[1.625em]',
                '[&_.ProseMirror_li]:list-item [&_.ProseMirror_li]:marker:text-foreground',
                '[&_.ProseMirror_ol]:[list-style-position:outside] [&_.ProseMirror_ul]:[list-style-position:outside]',
                '[&_.ProseMirror_li_ol]:mt-2 [&_.ProseMirror_li_ul]:mt-2',
                '[&_.ProseMirror_table]:my-4 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-border [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:bg-muted',
                '[&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-border [&_.ProseMirror_td]:p-2',
              ]
            : [
                'prose prose-sm dark:prose-invert max-w-none focus:outline-none',
                'prose-headings:font-semibold prose-headings:tracking-tight',
                'prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg',
                'prose-h1:mt-7 prose-h1:mb-1.5 prose-h2:mt-6 prose-h2:mb-1 prose-h3:mt-5 prose-h3:mb-1',
                'prose-p:my-2 prose-ul:my-2 prose-ol:my-2',
                'prose-li:my-1',
                'prose-table:my-4 prose-th:border prose-th:border-border prose-th:p-2 prose-th:bg-muted',
                'prose-td:border prose-td:border-border prose-td:p-2',
              ],
          '[&_.ProseMirror]:cursor-text',
          '[&_p.is-empty.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
          '[&_p.is-empty.is-editor-empty:first-child::before]:text-muted-foreground',
          '[&_p.is-empty.is-editor-empty:first-child::before]:float-left',
          '[&_p.is-empty.is-editor-empty:first-child::before]:h-0',
          '[&_p.is-empty.is-editor-empty:first-child::before]:pointer-events-none',
          '[&_p.is-empty.is-editor-empty:first-child::before]:!opacity-100',
          '[&_p.is-empty.is-editor-empty:first-child::before]:!visible',
          '[&_.ProseMirror_ul>li>p:empty]:min-h-[1.5em]',
          '[&_.ProseMirror_ol>li>p:empty]:min-h-[1.5em]',
          '[&_.ProseMirror_h1:empty]:min-h-[2em]',
          '[&_.ProseMirror_h2:empty]:min-h-[1.75em]',
          '[&_.ProseMirror_h3:empty]:min-h-[1.5em]',
          className
        ),
        'data-placeholder': placeholder,
      },
      handlePaste: (view, event) => {
        let pastedText = event.clipboardData?.getData('text/plain') ?? '';
        let pastedHtml = event.clipboardData?.getData('text/html') ?? '';
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
            if (behavior === 'strip_all' && (lines.length > 1 || !pastedHtml)) {
              const content = lines.map((line) => ({
                type: 'paragraph',
                content: line.length > 0 ? [{ type: 'text', text: line }] : [],
              }));
              const pos = editor.state.selection.from;
              editor.chain().deleteSelection().insertContentAt(pos, content).focus().run();
            } else if (behavior === 'strip_outside' && pastedHtml) {
              const transformed = stripOuterTablesFromHtml(pastedHtml);
              editor.chain().deleteSelection().insertContent(transformed).focus().run();
            } else if (behavior === 'keep' && pastedHtml) {
              editor.chain().deleteSelection().insertContent(pastedHtml).focus().run();
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
              if (behavior === 'strip_all') {
                const content = lines.map((line) => ({
                  type: 'paragraph',
                  content: line.length > 0 ? [{ type: 'text', text: line }] : [],
                }));
                const pos = editor.state.selection.from;
                editor.chain().deleteSelection().insertContentAt(pos, content).focus().run();
              } else if (behavior === 'strip_outside' && h) {
                const transformed = stripOuterTablesFromHtml(h);
                editor.chain().deleteSelection().insertContent(transformed).focus().run();
              } else if (behavior === 'keep' && h) {
                editor.chain().deleteSelection().insertContent(h).focus().run();
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

          // strip_all: convert everything to plain text lines (tables/images removed).
          if (behavior === 'strip_all') {
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
            const rawHtml =
              behavior === 'strip_outside'
                ? stripOuterTablesFromHtml(pastedHtml)
                : pastedHtml;

            if (
              onPasteImages &&
              /<img[\s\S]*?src\s*=\s*["']?(data:|blob:)/i.test(rawHtml)
            ) {
              extractImagesFromPastedHtml(rawHtml)
                .then((result) => {
                  if (result.files.length > 0) {
                    onPasteImages(editor, result.files, {
                      pastedHtml: result.htmlWithPlaceholders,
                    });
                  } else {
                    editor
                      .chain()
                      .deleteSelection()
                      .insertContent(rawHtml)
                      .focus()
                      .run();
                  }
                })
                .catch(() => {
                  editor
                    .chain()
                    .deleteSelection()
                    .insertContent(rawHtml)
                    .focus()
                    .run();
                });
            } else {
              editor
                .chain()
                .deleteSelection()
                .insertContent(rawHtml)
                .focus()
                .run();
            }
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

        // If clipboard contains image files and we have an image paste handler, handle it first.
        const items = event.clipboardData?.items;
        if (items && onPasteImages && editor) {
          const files: File[] = [];
          for (const item of Array.from(items)) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (file) files.push(file);
            }
          }
          if (files.length > 0) {
            onPasteImages(editor, files);
            return true;
          }

          // No image files: check for HTML with embedded images (e.g. paste from Word/Google Docs).
          const html = event.clipboardData?.getData('text/html');
          if (html && /<img[\s\S]*?src\s*=\s*["']?(data:|blob:)/i.test(html)) {
            event.preventDefault();
            extractImagesFromPastedHtml(html)
              .then((result) => {
                if (result.files.length > 0) {
                  onPasteImages(editor, result.files, {
                    pastedHtml: result.htmlWithPlaceholders,
                  });
                }
              })
              .catch(() => {});
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

      if (jsonString !== lastEmittedJsonRef.current) {
        lastEmittedJsonRef.current = jsonString;
        onChangeRef.current?.(json);
      }

      if (onMarkdownChangeRef.current) {
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

    if (isEcho) return;

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

    editor.commands.setContent(parsedContent as JSONContent | string, { contentType: isMarkdown ? 'markdown' : undefined });
  }, [content, editor, isMarkdown]);

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
      className={cn(
        'relative flex h-full min-h-0 w-full min-w-0 cursor-text flex-col overflow-visible',
        !editable && 'cursor-default'
      )}
      style={{ minHeight }}
      onClick={handleContainerClick}
      onPasteCapture={(e) => {
        clipboardCaptureRef.current = {
          text: e.clipboardData?.getData?.('text/plain') ?? '',
          html: e.clipboardData?.getData?.('text/html') ?? '',
        };
      }}
    >
      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-visible" />
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';
