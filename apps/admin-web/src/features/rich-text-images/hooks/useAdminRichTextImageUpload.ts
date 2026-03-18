'use client';

import { useCallback } from 'react';
import {
  PLACEHOLDER_NODE_NAME,
  type RichTextEditorRef,
} from '@altitutor/ui';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import type { SetImageOptions } from '@tiptap/extension-image';
import { uploadAdminRichTextImage } from '../api/uploadAdminRichTextImage';
import type { AdminRichTextImageContext } from '../api/uploadAdminRichTextImage';

export interface UseAdminRichTextImageUploadOptions {
  context: AdminRichTextImageContext;
  editorRef?: React.RefObject<RichTextEditorRef | null>;
}

/**
 * Returns handlePasteImages and handleDrop for wiring image uploads to RichTextEditor.
 * Use onPasteImages={handlePasteImages} and wrap editor in a div with onDrop={handleDrop}.
 */
export function useAdminRichTextImageUpload({
  context,
  editorRef,
}: UseAdminRichTextImageUploadOptions) {
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
          const { fileId, signedUrl } = await uploadAdminRichTextImage({
            file,
            context,
          });

          const state = editor.state;
          const doc = state.doc;
          const schema = state.schema;
          let placeholderPos: number | null = null;
          let placeholderSize = 0;
          doc.descendants((node: ProseMirrorNode, pos: number) => {
            if (
              node.type.name === PLACEHOLDER_NODE_NAME &&
              node.attrs.id === placeholderId
            ) {
              placeholderPos = pos;
              placeholderSize = node.nodeSize;
              return false;
            }
            return true;
          });

          if (placeholderPos !== null) {
            const imageNode = schema.nodes.image.create({
              src: signedUrl,
              alt: file.name,
              title: file.name,
              fileId,
            } as Record<string, unknown>);
            const tr = state.tr
              .delete(placeholderPos, placeholderPos + placeholderSize)
              .insert(placeholderPos, imageNode);
            editor.view.dispatch(tr);
            insertPos = placeholderPos + imageNode.nodeSize;
          } else {
            const docSize = doc.content.size;
            const safePos = Math.max(0, Math.min(insertPos, docSize));
            const $resolved = doc.resolve(safePos);
            editor.view.dispatch(
              state.tr.setSelection(TextSelection.near($resolved))
            );
            editor
              .chain()
              .focus()
              .setImage({
                src: signedUrl,
                alt: file.name,
                title: file.name,
                fileId,
              } as SetImageOptions & { fileId?: string })
              .run();
            insertPos = editor.state.selection.from;
          }
        } catch (error) {
          console.error(
            'Failed to upload admin rich text image:',
            error
          );
          const state = editor.state;
          state.doc.descendants((node: ProseMirrorNode, pos: number) => {
            if (
              node.type.name === PLACEHOLDER_NODE_NAME &&
              node.attrs.id === placeholderId
            ) {
              const tr = state.tr.delete(pos, pos + node.nodeSize);
              editor.view.dispatch(tr);
              return false;
            }
            return true;
          });
        }
      }
    },
    [context]
  );

  const handlePasteImages = useCallback(
    (
      editor: Editor,
      files: File[],
      options?: { pastedHtml?: string }
    ) => {
      const insertPos = editor.state.selection.from;

      if (options?.pastedHtml) {
        const pastedHtml: string = options.pastedHtml;
        void (async () => {
          const signedUrls: string[] = [];
          for (const file of files) {
            try {
              const { signedUrl } = await uploadAdminRichTextImage({
                file,
                context,
              });
              signedUrls.push(signedUrl);
            } catch (error) {
              console.error(
                'Failed to upload admin rich text image from pasted HTML:',
                error
              );
              signedUrls.push('');
            }
          }
          let html: string = pastedHtml;
          for (let i = 0; i < signedUrls.length; i += 1) {
            if (signedUrls[i]) {
              html = html.replace(`__UPLOAD_${i}__`, signedUrls[i]);
            }
          }
          editor
            .chain()
            .focus()
            .insertContentAt(
              insertPos,
              html as unknown as Parameters<
                Editor['commands']['insertContentAt']
              >[1]
            )
            .run();
        })();
        return;
      }

      void processImagesAtPosition(editor, files, insertPos);
    },
    [context, processImagesAtPosition]
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const dataTransfer = event.nativeEvent.dataTransfer;
      if (!dataTransfer?.files?.length) return;

      const files: File[] = Array.from(dataTransfer.files).filter((file) =>
        file.type.startsWith('image/')
      );
      if (files.length === 0) return;

      const editor = editorRef?.current?.getEditor();
      if (!editor) return;

      const view = editor.view;
      const state = view.state;
      let insertPos = state.selection.from;
      const coords = view.posAtCoords({
        left: event.clientX,
        top: event.clientY,
      });

      if (coords) {
        const doc = state.doc;
        let $pos = doc.resolve(coords.pos);
        if ($pos.parent === doc) {
          const before = doc.childBefore(coords.pos);
          const after = doc.childAfter(coords.pos);
          if (!before.node && after.node) {
            insertPos = after.offset;
          } else if (before.node && !after.node) {
            insertPos = before.offset + before.node.nodeSize;
          } else if (before.node && after.node) {
            const beforeEnd = before.offset + before.node.nodeSize;
            const distToBefore = coords.pos - beforeEnd;
            const distToAfter = after.offset - coords.pos;
            insertPos =
              distToBefore <= distToAfter ? beforeEnd : after.offset;
          }
        } else {
          while ($pos.depth > 0 && !$pos.parent.isBlock) {
            $pos = doc.resolve($pos.before());
          }
          const blockStart = $pos.start();
          const blockEnd = $pos.end();
          const mid = (blockStart + blockEnd) / 2;
          insertPos = coords.pos < mid ? blockStart : blockEnd;
        }
      }

      await processImagesAtPosition(editor, files, insertPos);
    },
    [editorRef, processImagesAtPosition]
  );

  return { handlePasteImages, handleDrop };
}
