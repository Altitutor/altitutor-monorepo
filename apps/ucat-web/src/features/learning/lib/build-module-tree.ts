import type { LearningModuleRow, LearningModuleTreeNode } from "@/features/learning/types";

export function buildLearningModuleTree(
  modules: LearningModuleRow[],
): LearningModuleTreeNode[] {
  const byParent = new Map<string | null, LearningModuleRow[]>();

  for (const row of modules) {
    const parentId = row.parent_ucat_learning_module_id ?? null;
    const list = byParent.get(parentId) ?? [];
    list.push(row);
    byParent.set(parentId, list);
  }

  const sortNodes = (nodes: LearningModuleRow[]) =>
    [...nodes].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  const toTree = (parentId: string | null): LearningModuleTreeNode[] =>
    sortNodes(byParent.get(parentId) ?? []).map((row) => ({
      ...row,
      children: row.id ? toTree(row.id) : [],
    }));

  return toTree(null);
}

export function groupModulesBySection(
  modules: LearningModuleTreeNode[],
): Array<{ sectionId: string | null; sectionName: string; nodes: LearningModuleTreeNode[] }> {
  const groups = new Map<
    string,
    { sectionId: string | null; sectionName: string; nodes: LearningModuleTreeNode[] }
  >();

  for (const node of modules) {
    const sectionId = node.ucat_section_id ?? "none";
    const sectionName = node.section_name ?? "General";
    const group = groups.get(sectionId) ?? {
      sectionId: node.ucat_section_id ?? null,
      sectionName,
      nodes: [],
    };
    group.nodes.push(node);
    groups.set(sectionId, group);
  }

  return [...groups.values()];
}
