import type { ResourceTopicNode } from '@altitutor/shared';

export function topicBreadcrumb(tree: ResourceTopicNode[], topicId: string): ResourceTopicNode[] {
  function walk(nodes: ResourceTopicNode[], trail: ResourceTopicNode[]): ResourceTopicNode[] | null {
    for (const node of nodes) {
      const next = [...trail, node];
      if (node.id === topicId) return next;
      const found = walk(node.children, next);
      if (found) return found;
    }
    return null;
  }
  return walk(tree, []) ?? [];
}

export function resourceTypeSymbol(type: string): string {
  switch (type) {
    case 'NOTES': return 'doc.text';
    case 'TEST': return 'checklist';
    case 'PRACTICE_QUESTIONS': return 'pencil.and.list.clipboard';
    case 'VIDEO': return 'play.rectangle';
    case 'EXAM': return 'graduationcap';
    case 'FLASHCARDS': return 'rectangle.on.rectangle';
    case 'REVISION_SHEET': return 'doc.plaintext';
    case 'CHEAT_SHEET': return 'bolt';
    default: return 'doc';
  }
}
