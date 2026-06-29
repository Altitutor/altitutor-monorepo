'use client';

import { useCallback } from 'react';
import { PLACEHOLDER_NODE_NAME, type RichTextEditorRef } from '@altitutor/ui';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import type { SetImageOptions } from '@tiptap/extension-image';
import { uploadFlashcardImage, type UploadFlashcardImageResult } from '../api/flashcard-images';

const BUCKET = 'flashcard-images';

type FlashcardImageAttrs = SetImageOptions & {
  fileId?: string;
  storageBucket?: string;
  storagePath?: string;
};

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function imageAttrs(file: File, result: UploadFlashcardImageResult): FlashcardImageAttrs {
  return {
    src: result.signedUrl,
    alt: file.name,
    title: file.name,
    fileId: result.fileId,
    storageBucket: BUCKET,
    storagePath: result.storagePath,
  };
}

function replaceUploadPlaceholder(html: string, index: number, file: File, result: UploadFlashcardImageResult): string {
  const attrs = `src="${escapeAttribute(result.signedUrl)}" alt="${escapeAttribute(file.name)}" title="${escapeAttribute(file.name)}" data-file-id="${escapeAttribute(result.fileId)}" data-storage-bucket="${BUCKET}" data-storage-path="${escapeAttribute(result.storagePath)}"`;
  return html
    .replace(`src="__UPLOAD_${index}__"`, attrs)
    .replace(`src='__UPLOAD_${index}__'`, attrs);
}

export function useFlashcardImageUpload({
  topicId,
  editorRef,
}: {
  topicId: string;
  editorRef?: React.RefObject<RichTextEditorRef | null>;
}) {
  const processImagesAtPosition = useCallback(
    async (editor: Editor, files: File[], insertPos: number) => {
      for (const file of files) {
        const placeholderId = crypto.randomUUID();

        editor
          .chain()
          .focus()
          .insertContentAt(insertPos, {
            type: PLACEHOLDER_NODE_NAME,
            attrs: { id: placeholderId },
          })
          .run();

        try {
          const upload = await uploadFlashcardImage(topicId, file);
          const state = editor.state;
          const doc = state.doc;
          const schema = state.schema;
          let placeholderPos: number | null = null;
          let placeholderSize = 0;

          doc.descendants((node: ProseMirrorNode, pos: number) => {
            if (node.type.name === PLACEHOLDER_NODE_NAME && node.attrs.id === placeholderId) {
              placeholderPos = pos;
              placeholderSize = node.nodeSize;
              return false;
            }
            return true;
          });

          if (placeholderPos !== null) {
            const imageNode = schema.nodes.image.create(imageAttrs(file, upload) as unknown as Record<string, unknown>);
            const tr = state.tr
              .delete(placeholderPos, placeholderPos + placeholderSize)
              .insert(placeholderPos, imageNode);
            editor.view.dispatch(tr);
            insertPos = placeholderPos + imageNode.nodeSize;
          } else {
            const safePos = Math.max(0, Math.min(insertPos, doc.content.size));
            editor.view.dispatch(state.tr.setSelection(TextSelection.near(doc.resolve(safePos))));
            editor.chain().focus().setImage(imageAttrs(file, upload)).run();
            insertPos = editor.state.selection.from;
          }
        } catch (error) {
          console.error('Failed to upload flashcard image:', error);
          const state = editor.state;
          state.doc.descendants((node: ProseMirrorNode, pos: number) => {
            if (node.type.name === PLACEHOLDER_NODE_NAME && node.attrs.id === placeholderId) {
              editor.view.dispatch(state.tr.delete(pos, pos + node.nodeSize));
              return false;
            }
            return true;
          });
        }
      }
    },
    [topicId],
  );

  const handlePasteImages = useCallback(
    (editor: Editor, files: File[], options?: { pastedHtml?: string }) => {
      const insertPos = editor.state.selection.from;

      if (options?.pastedHtml) {
        void (async () => {
          let html = options.pastedHtml ?? '';
          for (let i = 0; i < files.length; i += 1) {
            try {
              const upload = await uploadFlashcardImage(topicId, files[i]);
              html = replaceUploadPlaceholder(html, i, files[i], upload);
            } catch (error) {
              console.error('Failed to upload flashcard image from pasted HTML:', error);
              html = html.replace(`__UPLOAD_${i}__`, '');
            }
          }
          editor
            .chain()
            .focus()
            .insertContentAt(insertPos, html as unknown as Parameters<Editor['commands']['insertContentAt']>[1])
            .run();
        })();
        return;
      }

      void processImagesAtPosition(editor, files, insertPos);
    },
    [processImagesAtPosition, topicId],
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const files = Array.from(event.nativeEvent.dataTransfer?.files ?? []).filter((file) => file.type.startsWith('image/'));
      if (!files.length) return;

      const editor = editorRef?.current?.getEditor();
      if (!editor) return;

      const coords = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
      const insertPos = coords?.pos ?? editor.state.selection.from;
      await processImagesAtPosition(editor, files, insertPos);
    },
    [editorRef, processImagesAtPosition],
  );

  return { handlePasteImages, handleDrop };
}
