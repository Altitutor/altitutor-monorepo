import type { Json } from '@altitutor/shared';

/**
 * Extract plain text from ProseMirror/TipTap JSON content.
 * Handles nested structures (paragraphs, tables, lists, etc.)
 */
export function proseMirrorToPlainText(value: Json | null | undefined): string {
  if (value == null) return '';

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(proseMirrorToPlainText).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  const record = value as Record<string, unknown>;

  if (Array.isArray(record.content)) {
    return record.content
      .map((node: unknown) => proseMirrorToPlainText(node as Json))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (typeof record.text === 'string') {
    return record.text;
  }

  return Object.values(record)
    .map((v: unknown) => proseMirrorToPlainText(v as Json))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
