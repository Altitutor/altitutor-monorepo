import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const JUMP_HIGHLIGHT_META = 'jumpHighlight';
const HIGHLIGHT_CLASS = 'note-jump-highlight';
const HIGHLIGHT_DURATION_MS = 2000;

interface JumpHighlightState {
  pos: number;
  length: number;
  isBlock: boolean;
}

const jumpHighlightPluginKey = new PluginKey<JumpHighlightState | null>('jumpHighlight');

/**
 * TipTap extension that adds temporary highlight decorations when jumping to
 * headings or search results. Triggered via transaction meta JUMP_HIGHLIGHT_META.
 */
export const JumpHighlightExtension = Extension.create({
  name: 'jumpHighlight',

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin<JumpHighlightState | null>({
        key: jumpHighlightPluginKey,

        state: {
          init: () => null,
          apply(tr, value) {
            const meta = tr.getMeta(JUMP_HIGHLIGHT_META);
            if (meta === null) return null;
            if (meta && typeof meta.pos === 'number' && typeof meta.length === 'number') {
              return { pos: meta.pos, length: meta.length, isBlock: !!meta.isBlock };
            }
            return value;
          },
        },

        props: {
          decorations(state) {
            const highlight = jumpHighlightPluginKey.getState(state);
            if (!highlight) return null;

            const { pos, length, isBlock } = highlight;
            const doc = state.doc;
            const from = pos;
            const to = pos + length;

            if (from < 0 || to > doc.content.size) return null;

            const deco = isBlock
              ? Decoration.node(from, to, { class: HIGHLIGHT_CLASS })
              : Decoration.inline(from, to, { class: HIGHLIGHT_CLASS });

            const set = DecorationSet.create(doc, [deco]);

            // Clear after duration via a no-op transaction
            setTimeout(() => {
              const { view } = editor;
              if (!view) return;
              const current = jumpHighlightPluginKey.getState(view.state);
              if (current && current.pos === pos && current.length === length) {
                view.dispatch(view.state.tr.setMeta(JUMP_HIGHLIGHT_META, null));
              }
            }, HIGHLIGHT_DURATION_MS);

            return set;
          },
        },
      }),
    ];
  },
});
