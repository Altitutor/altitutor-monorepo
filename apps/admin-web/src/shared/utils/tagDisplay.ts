import { extractDisplayText } from './tagParsing';

/**
 * Converts text with tag markers to display text (tags replaced with their display text)
 * Used in activity feed where we just want to show the text without pills
 */
export function renderTextWithTagsAsPlainText(text: string | null | undefined): string {
  if (!text) return '';
  return extractDisplayText(text);
}
