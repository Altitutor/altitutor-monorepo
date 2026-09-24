import { learningModuleHref } from "@/features/learning/lib/learning-module-href";
import { expandQuestionTagIds } from "@/features/study-plan/lib/tag-hierarchy";
import type { QuestionTagHierarchyRow } from "@/features/study-plan/lib/tag-hierarchy";

export type RemediationLessonLink = {
  id: string;
  title: string;
  href: string;
};

export type RemediationCatalogLesson = {
  id: string;
  title: string;
  sectionId: string | null;
  sectionNumber: number | null;
  studyPlanPriority: "essential" | "recommended" | "optional" | "excluded";
  categoryIds: string[];
  authoredQuestionTagIds: string[];
};

export type RemediationCatalog = {
  lessons: readonly RemediationCatalogLesson[];
  tagTaxonomy: readonly QuestionTagHierarchyRow[];
};

export function questionTagIdsFromMetadata(
  tags: readonly { id?: string | null }[],
): string[] {
  return tags.flatMap((tag) => (tag.id ? [tag.id] : []));
}

export type RemediationQuestionInput = {
  result: "correct" | "partial" | "incorrect" | "not_attempted";
  questionTagIds: readonly string[];
  stemCategoryId: string | null;
  sectionId: string | null;
};

const MAX_RELATED_LESSONS = 3;

const PRIORITY_SCORE: Record<RemediationCatalogLesson["studyPlanPriority"], number> =
  {
    essential: 3,
    recommended: 2,
    optional: 1,
    excluded: 0,
  };

function lessonScore(
  lesson: RemediationCatalogLesson,
  tagMatch: boolean,
  categoryMatch: boolean,
): number {
  return (
    (tagMatch ? 4 : 0) +
    (categoryMatch ? 2 : 0) +
    PRIORITY_SCORE[lesson.studyPlanPriority]
  );
}

export function matchRemediationLearningModules(
  question: RemediationQuestionInput,
  catalog: RemediationCatalog,
): RemediationLessonLink[] {
  if (question.result === "correct" || question.result === "not_attempted") {
    return [];
  }

  const questionTagIds = new Set(question.questionTagIds.filter(Boolean));
  const ranked = catalog.lessons.flatMap((lesson) => {
    if (lesson.studyPlanPriority === "excluded") return [];
    if (
      question.sectionId &&
      lesson.sectionId &&
      question.sectionId !== lesson.sectionId
    ) {
      return [];
    }

    const expandedTagIds = expandQuestionTagIds(
      lesson.authoredQuestionTagIds,
      [...catalog.tagTaxonomy],
    );
    const tagMatch = expandedTagIds.some((tagId) => questionTagIds.has(tagId));
    const categoryMatch = Boolean(
      question.stemCategoryId &&
        lesson.categoryIds.includes(question.stemCategoryId),
    );
    if (!tagMatch && !categoryMatch) return [];

    return [
      {
        lesson,
        score: lessonScore(lesson, tagMatch, categoryMatch),
      },
    ];
  });

  return ranked
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.lesson.title.localeCompare(right.lesson.title),
    )
    .slice(0, MAX_RELATED_LESSONS)
    .map(({ lesson }) => ({
      id: lesson.id,
      title: lesson.title,
      href: learningModuleHref(lesson.id, lesson.sectionNumber),
    }));
}
