/**
 * Tag utilities for entity mentions.
 * Tag format: @[entityType:entityId:displayText]
 * Used for clipboard "Copy as mention" in session tables.
 */

export type TagEntityType = 'student' | 'staff' | 'parent' | 'class' | 'subject' | 'session' | 'topic' | 'file' | 'invoice' | 'task' | 'issue' | 'project';

/**
 * Create a tag marker string for clipboard copy
 */
export function createTagMarker(
  type: TagEntityType,
  id: string,
  displayText: string
): string {
  return `@[${type}:${id}:${displayText}]`;
}
