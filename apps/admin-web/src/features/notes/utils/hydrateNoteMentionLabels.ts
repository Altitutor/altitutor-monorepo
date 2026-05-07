import type { JSONContent } from '@tiptap/core';

function walkDoc(content: JSONContent | null | undefined, visit: (node: JSONContent) => void): void {
  if (!content) return;
  visit(content);
  if (content.content?.length) {
    for (const child of content.content) {
      walkDoc(child, visit);
    }
  }
}

/** Collect ids of inline mentions that reference another note (`type === 'note'`). */
export function collectLinkedNoteIds(content: JSONContent | null | undefined): string[] {
  const ids = new Set<string>();
  walkDoc(content, (node) => {
    if (
      node.type === 'mention' &&
      node.attrs &&
      typeof node.attrs.id === 'string' &&
      node.attrs.type === 'note'
    ) {
      ids.add(node.attrs.id);
    }
  });
  return [...ids];
}

function patchMentionLabels(node: JSONContent, titles: Record<string, string>): JSONContent {
  if (
    node.type === 'mention' &&
    node.attrs &&
    typeof node.attrs.id === 'string' &&
    node.attrs.type === 'note'
  ) {
    const title = titles[node.attrs.id];
    if (title !== undefined && node.attrs.label !== title) {
      return {
        ...node,
        attrs: { ...node.attrs, label: title },
      };
    }
    return node;
  }

  if (!node.content?.length) {
    return node;
  }

  let changed = false;
  const nextContent = node.content.map((child) => {
    const patched = patchMentionLabels(child, titles);
    if (patched !== child) changed = true;
    return patched;
  });

  return changed ? { ...node, content: nextContent } : node;
}

/** Deep-update `mention` nodes with `type: note` so `label` matches current titles. */
export function applyLinkedNoteTitles(content: JSONContent, titles: Record<string, string>): JSONContent {
  return patchMentionLabels(content, titles);
}
