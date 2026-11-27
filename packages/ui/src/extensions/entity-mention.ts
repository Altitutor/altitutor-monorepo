import Mention from '@tiptap/extension-mention';
import { mergeAttributes } from '@tiptap/core';
import { Plugin, TextSelection } from '@tiptap/pm/state';
import { entityChipStyles, entityIconPaths } from '../components/entity-chip';
import { entityReferenceDragType, readEntityReferenceDrag } from '../lib/entity-reference-drag';

/** One presentation for entity references in editors and serialized document viewers. */
export const EntityMention = Mention.extend({
  addProseMirrorPlugins() {
    const mentionType = this.type;
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        props: {
          handleDOMEvents: {
            dragover(view, event) {
              if (!view.editable || !event.dataTransfer?.types.includes(entityReferenceDragType)) return false;

              event.preventDefault();
              event.dataTransfer.dropEffect = 'copy';
              return true;
            },
            drop(view, event) {
              if (!view.editable || !event.dataTransfer?.types.includes(entityReferenceDragType)) return false;

              event.preventDefault();
              const reference = readEntityReferenceDrag(event.dataTransfer);
              if (!reference) return true;

              const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (!hit) return true;

              const { state } = view;
              const $position = TextSelection.near(state.doc.resolve(hit.pos)).$from;
              if (!$position.parent.type.contentMatch.matchType(mentionType)) return true;

              const mention = mentionType.create(reference);
              const afterMention = $position.pos + mention.nodeSize;
              const transaction = state.tr.insert($position.pos, mention);
              if (!$position.nodeAfter?.text?.startsWith(' ')) {
                transaction.insertText(' ', afterMention);
              }
              transaction.setSelection(TextSelection.create(transaction.doc, afterMention + 1));
              view.dispatch(transaction);
              view.focus();
              return true;
            },
          },
        },
      }),
    ];
  },
  parseHTML() {
    return [{tag: 'span[data-mention]'}, {tag: 'span[data-type="mention"]'}];
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {default: null, parseHTML: el => el.getAttribute('data-id'), renderHTML: attrs => ({'data-id': attrs.id})},
      label: {default: null, parseHTML: el => el.getAttribute('data-label') || el.textContent, renderHTML: attrs => ({'data-label': attrs.label})},
      type: {default: null, parseHTML: el => el.getAttribute('data-type'), renderHTML: attrs => ({'data-type': attrs.type})},
    };
  },
  renderHTML({node, HTMLAttributes}) {
    const type = String(node.attrs.type ?? 'file');
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      class: entityChipStyles, 'data-mention': 'true', role: 'button', tabindex: '0',
    }),
      ['http://www.w3.org/2000/svg svg', {xmlns: 'http://www.w3.org/2000/svg', width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'shrink-0'}, ...entityIconPaths(type).map(d => ['path', {d}])],
      ['span', {class: 'truncate'}, String(node.attrs.label ?? node.attrs.id ?? '')],
    ];
  },
});
