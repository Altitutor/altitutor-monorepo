import type { LearningModuleBlockRow } from "@/features/learning/types";

export function formatBlockLabel(block: LearningModuleBlockRow, index: number): string {
  const typeLabel = block.block_type?.replace(/_/g, " ") ?? "Block";
  return `${index + 1}. ${typeLabel}`;
}
