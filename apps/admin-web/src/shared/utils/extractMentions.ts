import type { JSONContent } from '@altitutor/ui';

export interface ExtractedMention {
  id: string;
  type: string;
  label: string;
}

/**
 * Recursively extract all mention nodes from Tiptap JSON content
 */
export function extractMentions(content: JSONContent | null | undefined): ExtractedMention[] {
  if (!content) return [];
  
  const mentions: ExtractedMention[] = [];

  const traverse = (node: JSONContent) => {
    if (node.type === 'mention' && node.attrs) {
      mentions.push({
        id: node.attrs.id,
        type: node.attrs.type,
        label: node.attrs.label,
      });
    }

    if (node.content) {
      node.content.forEach(traverse);
    }
  };

  traverse(content);

  // Return unique mentions by ID and type
  return Array.from(new Map(
    mentions.map(m => [`${m.type}:${m.id}`, m])
  ).values());
}
