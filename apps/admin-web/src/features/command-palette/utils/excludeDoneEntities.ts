import type { CommandPaletteEntityResult } from '../types';

/**
 * Hide terminal-state work items from search/mention results.
 * Issues: resolved · Projects: completed · Tasks: done
 */
export function isActiveEntityForSearch(result: CommandPaletteEntityResult): boolean {
  switch (result.type) {
    case 'task':
      return result.data.status !== 'done';
    case 'issue':
      return result.data.status !== 'resolved';
    case 'project':
      return result.data.status !== 'completed';
    case 'student':
    case 'staff':
    case 'parent':
    case 'class':
    case 'subject':
    case 'topic':
    case 'file':
    case 'note':
      return true;
    default: {
      const _exhaustive: never = result;
      return _exhaustive;
    }
  }
}

export function excludeDoneEntities(
  results: CommandPaletteEntityResult[],
): CommandPaletteEntityResult[] {
  return results.filter(isActiveEntityForSearch);
}
