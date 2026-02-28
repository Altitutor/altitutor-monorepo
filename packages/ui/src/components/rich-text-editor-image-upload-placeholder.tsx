'use client';

import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { Spinner } from './spinner';

const PLACEHOLDER_NODE_NAME = 'imageUploadPlaceholder';

/**
 * React node view shown in the editor while an image is uploading.
 * Renders a loading state at the insert position until the image is replaced.
 */
function ImageUploadPlaceholderView() {
  return (
    <NodeViewWrapper
      as="div"
      className="my-3 flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-4"
      data-image-upload-placeholder
    >
      <Spinner size="sm" className="shrink-0" />
      <span className="text-muted-foreground text-sm">Uploading image…</span>
    </NodeViewWrapper>
  );
}

/**
 * Tiptap block node used as a loading placeholder where an image will be
 * inserted. Insert at drop position before upload; replace with Image node
 * when upload completes. Node has an `id` attribute so the correct placeholder
 * can be found and replaced.
 */
export const ImageUploadPlaceholderExtension = Node.create({
  name: PLACEHOLDER_NODE_NAME,

  group: 'block',
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-placeholder-id'),
        renderHTML: (attributes) =>
          attributes.id ? { 'data-placeholder-id': attributes.id } : {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageUploadPlaceholderView);
  },

  parseHTML() {
    return [{ tag: `div[data-image-upload-placeholder]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      {
        ...HTMLAttributes,
        'data-image-upload-placeholder': '',
        class:
          'my-3 flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-4',
      },
      ['span', { class: 'text-muted-foreground text-sm' }, 'Uploading image…'],
    ];
  },
});

export { PLACEHOLDER_NODE_NAME };
