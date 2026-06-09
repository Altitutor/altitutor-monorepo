import type { LearningModuleRow } from "@/features/learning/types";

/** Folder ancestors from root down to the lesson's parent (excludes the lesson). */
export function buildLessonAncestorPath(
  lessonId: string,
  modules: LearningModuleRow[],
): LearningModuleRow[] {
  const byId = new Map(
    modules.flatMap((module) => (module.id ? [[module.id, module] as const] : [])),
  );

  const ancestors: LearningModuleRow[] = [];
  let parentId = byId.get(lessonId)?.parent_ucat_learning_module_id ?? null;

  while (parentId) {
    const parent = byId.get(parentId);
    if (!parent) break;
    ancestors.unshift(parent);
    parentId = parent.parent_ucat_learning_module_id ?? null;
  }

  return ancestors;
}
