import { Extension } from '@tiptap/core';
import { NodeSelection, Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const IMAGE_RANGE_SELECTION_CLASS = 'ProseMirror-image-range-selected';

/** Marks image nodes included in a text selection so range selection remains visible. */
export const ImageSelectionHighlight = Extension.create({
  name: 'imageSelectionHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const { selection } = state;
            if (selection.empty || selection instanceof NodeSelection) {
              return DecorationSet.empty;
            }

            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name !== 'image') return true;

              const nodeEnd = pos + node.nodeSize;
              if (selection.from < nodeEnd && selection.to > pos) {
                decorations.push(
                  Decoration.node(pos, nodeEnd, { class: IMAGE_RANGE_SELECTION_CLASS }),
                );
              }
              return false;
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
