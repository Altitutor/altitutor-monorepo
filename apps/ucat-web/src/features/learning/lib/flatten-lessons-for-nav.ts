import {
  buildLearningModuleTree,
  groupModulesBySection,
} from "@/features/learning/lib/build-module-tree";
import type { LearningModuleRow, LearningModuleTreeNode } from "@/features/learning/types";

export type LessonNavEntry = {
  id: string;
  label: string;
  href: string;
};

function walkLessonNodes(
  nodes: LearningModuleTreeNode[],
  lessons: LessonNavEntry[],
): void {
  for (const node of nodes) {
    if (node.kind === "lesson" && node.id) {
      lessons.push({
        id: node.id,
        label: node.title ?? "Lesson",
        href: `/learn/${node.id}`,
      });
    }
    if (node.children.length > 0) {
      walkLessonNodes(node.children, lessons);
    }
  }
}

/** Lessons in catalog order: section groups, then depth-first within each tree. */
export function flattenLessonsForNav(modules: LearningModuleRow[]): LessonNavEntry[] {
  const tree = buildLearningModuleTree(modules);
  const sections = groupModulesBySection(tree);
  const lessons: LessonNavEntry[] = [];

  for (const section of sections) {
    walkLessonNodes(section.nodes, lessons);
  }

  return lessons;
}

export function getAdjacentLessons(
  lessonId: string,
  modules: LearningModuleRow[],
): { prev: LessonNavEntry | null; next: LessonNavEntry | null } {
  const flat = flattenLessonsForNav(modules);
  const index = flat.findIndex((lesson) => lesson.id === lessonId);
  if (index === -1) {
    return { prev: null, next: null };
  }

  return {
    prev: index > 0 ? flat[index - 1] : null,
    next: index < flat.length - 1 ? flat[index + 1] : null,
  };
}
