import type { Json } from '@altitutor/shared';

/**
 * Extract plain text from TipTap/ProseMirror JSON content.
 * Handles doc with content array, text nodes, and mention nodes.
 */
export function extractTextFromNoteContent(value: Json | null | undefined): string {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(extractTextFromNoteContent).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  const record = value as Record<string, Json>;

  // Mention node: use label from attrs
  if (record['type'] === 'mention' && record['attrs'] && typeof record['attrs'] === 'object') {
    const attrs = record['attrs'] as Record<string, Json>;
    const label = attrs['label'];
    return typeof label === 'string' ? label : '';
  }

  // Text node
  if (typeof record['text'] === 'string') {
    return record['text'];
  }

  // Doc or block node with content array
  if (Array.isArray(record['content'])) {
    return record['content']
      .map((node) => extractTextFromNoteContent(node))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return '';
}
