const TAG_PATTERN = /@\[[^:]+:[^:]+:(.+?)\]/g;

/**
 * Converts text with tag markers to display text (tags replaced with their display text).
 * Used in activity feed and notes where we show plain text.
 */
export function renderTextWithTagsAsPlainText(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(TAG_PATTERN, (_, displayText) => displayText);
}
