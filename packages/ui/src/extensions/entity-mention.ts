import Mention from '@tiptap/extension-mention';
import { mergeAttributes } from '@tiptap/core';
import { entityChipStyles, entityIconPaths } from '../components/entity-chip';

/** One presentation for entity references in editors and serialized document viewers. */
export const EntityMention = Mention.extend({
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
