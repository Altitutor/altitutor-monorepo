export type QuestionTagHierarchyRow = {
  id: string;
  parent_question_tag_id: string | null;
};

/**
 * Expands authored tag IDs to include every reachable descendant.
 * Unknown IDs are retained, and malformed cycles terminate safely.
 */
export function expandQuestionTagIds(
  authoredTagIds: string[],
  hierarchy: QuestionTagHierarchyRow[],
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const tag of hierarchy) {
    if (!tag.parent_question_tag_id) continue;
    childrenByParent.set(tag.parent_question_tag_id, [
      ...(childrenByParent.get(tag.parent_question_tag_id) ?? []),
      tag.id,
    ]);
  }

  const expanded = new Set(authoredTagIds);
  const pending = [...authoredTagIds];
  for (let index = 0; index < pending.length; index += 1) {
    for (const childId of childrenByParent.get(pending[index]!) ?? []) {
      if (expanded.has(childId)) continue;
      expanded.add(childId);
      pending.push(childId);
    }
  }
  return [...expanded];
}
