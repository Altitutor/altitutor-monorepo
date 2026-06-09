import type { UcatLearningModuleRow } from '@/features/ucat/learning-modules/types'

export function getNextLearningModuleIndex(
  rows: UcatLearningModuleRow[],
  parentId: string | null,
): number {
  const siblings = rows.filter((row) => row.parent_ucat_learning_module_id === parentId)
  if (siblings.length === 0) return 0
  return Math.max(...siblings.map((row) => row.index)) + 1
}
