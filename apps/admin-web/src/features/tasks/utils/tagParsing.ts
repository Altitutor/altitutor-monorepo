/**
 * Tag parsing utilities for inline entity mentions in task titles/descriptions
 * 
 * Tag format: @[entityType:entityId:displayText]
 * Example: @[student:abc-123:John Doe]
 */

export type TagEntityType = 'student' | 'staff' | 'parent' | 'class' | 'session' | 'topic' | 'file';

export interface ParsedTag {
  type: TagEntityType;
  id: string;
  displayText: string;
  startIndex: number;
  endIndex: number;
  fullMatch: string; // The full @[type:id:text] string
}

/**
 * Regex pattern to match tag markers in text
 * Matches: @[type:id:text]
 */
const TAG_PATTERN = /@\[([^:]+):([^:]+):([^\]]+)\]/g;

/**
 * Parse all tags from a text string
 */
export function parseTags(text: string): ParsedTag[] {
  const tags: ParsedTag[] = [];
  let match: RegExpExecArray | null;

  // Reset regex lastIndex to ensure we start from the beginning
  TAG_PATTERN.lastIndex = 0;

  while ((match = TAG_PATTERN.exec(text)) !== null) {
    const [fullMatch, type, id, displayText] = match;
    tags.push({
      type: type as TagEntityType,
      id,
      displayText,
      startIndex: match.index,
      endIndex: match.index + fullMatch.length,
      fullMatch,
    });
  }

  return tags;
}

/**
 * Create a tag marker string from entity data
 */
export function createTagMarker(
  type: TagEntityType,
  id: string,
  displayText: string
): string {
  return `@[${type}:${id}:${displayText}]`;
}

/**
 * Check if a position in text is inside a tag
 */
export function isPositionInTag(text: string, position: number): boolean {
  const tags = parseTags(text);
  return tags.some(
    (tag) => position >= tag.startIndex && position <= tag.endIndex
  );
}

/**
 * Get the tag at a specific position, if any
 */
export function getTagAtPosition(
  text: string,
  position: number
): ParsedTag | null {
  const tags = parseTags(text);
  return (
    tags.find(
      (tag) => position >= tag.startIndex && position <= tag.endIndex
    ) || null
  );
}

/**
 * Check if editing at a position would break a tag
 * Returns true if inserting/deleting at this position would modify the tag marker
 */
export function wouldBreakTag(text: string, position: number): boolean {
  const tag = getTagAtPosition(text, position);
  if (!tag) return false;

  // Check if position is strictly inside the tag (not at boundaries)
  // We allow editing at the start (@) and end (]) boundaries
  return position > tag.startIndex && position < tag.endIndex;
}

/**
 * Remove all tags from text, returning plain text
 */
export function removeTags(text: string): string {
  return text.replace(TAG_PATTERN, '');
}

/**
 * Extract plain text with tags replaced by display text
 * This is what users see visually
 */
export function extractDisplayText(text: string): string {
  return text.replace(TAG_PATTERN, (match, type, id, displayText) => {
    return displayText;
  });
}

/**
 * Find the start of the current @ mention being typed
 * Returns the position of @ or -1 if not found
 */
export function findMentionStart(text: string, cursorPosition: number): number {
  // Look backwards from cursor position for @
  for (let i = cursorPosition - 1; i >= 0; i--) {
    const char = text[i];
    
    // If we hit a space before finding @, no mention (but allow newlines for multi-line support)
    if (char === ' ') {
      return -1;
    }
    
    // If we find @, check if it's part of a tag marker
    if (char === '@') {
      // Check if this @ is part of a complete tag marker
      const afterAt = text.slice(i);
      if (afterAt.match(/^@\[/)) {
        // This is a complete tag, not a mention being typed
        return -1;
      }
      return i;
    }
  }
  
  return -1;
}

/**
 * Extract the search query from an @ mention being typed
 * Returns the text after @ up to cursor position (empty string if just '@')
 */
export function extractMentionQuery(
  text: string,
  cursorPosition: number
): string | null {
  const mentionStart = findMentionStart(text, cursorPosition);
  if (mentionStart === -1) return null;
  
  // Return empty string if cursor is right after @, otherwise return the query
  const query = text.slice(mentionStart + 1, cursorPosition);
  return query; // Can be empty string, which is valid
}
