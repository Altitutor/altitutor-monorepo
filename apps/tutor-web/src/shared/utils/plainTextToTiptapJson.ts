import type { JSONContent } from '@altitutor/ui';

const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [] }],
};

/**
 * Check if TipTap JSON content is empty (no text)
 */
export function isTiptapContentEmpty(content: JSONContent | null | undefined): boolean {
  if (!content) return true;
  const hasText = (node: JSONContent): boolean => {
    if (node.type === 'text' && (node as { text?: string }).text?.trim()) return true;
    if (node.type === 'mention') return true;
    for (const c of node.content || []) {
      if (hasText(c)) return true;
    }
    return false;
  };
  return !hasText(content);
}

/**
 * Convert any note content (DB value) to JSONContent for the editor.
 */
export function toEditorContent(value: unknown): JSONContent {
  if (value == null) return EMPTY_DOC;
  if (typeof value === 'string') return plainTextToTiptapJson(value);
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if (obj.type === 'doc' || Array.isArray(obj.content)) {
      return value as JSONContent;
    }
  }
  return plainTextToTiptapJson(String(value));
}

/**
 * Convert plain text to TipTap ProseMirror JSON structure.
 */
export function plainTextToTiptapJson(val: string | null | undefined): JSONContent {
  if (val === null || val === undefined || val === '') {
    return EMPTY_DOC;
  }

  const trimmed = val.trim();
  if (!trimmed) {
    return EMPTY_DOC;
  }

  if (trimmed.startsWith('{') && (trimmed.includes('"type"') || trimmed.includes('"content"'))) {
    try {
      const parsed = JSON.parse(val) as JSONContent;
      if (parsed.type === 'doc' || parsed.content) {
        return parsed;
      }
    } catch {
      // Fall through
    }
  }

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: val }],
      },
    ],
  };
}
