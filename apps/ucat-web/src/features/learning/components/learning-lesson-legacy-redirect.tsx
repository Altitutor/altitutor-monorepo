"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LearningLessonPageSkeleton } from "@/features/learning/components/learning-lesson-page-skeleton";
import { useLearningModules } from "@/features/learning/hooks/use-learning";
import { learningModuleHref } from "@/features/learning/lib/learning-module-href";

export function LearningLessonLegacyRedirect({
  lessonId,
  studyPlanTaskId,
}: {
  lessonId: string;
  studyPlanTaskId: string | null;
}) {
  const router = useRouter();
  const { data: modules, isLoading } = useLearningModules();

  useEffect(() => {
    if (isLoading) return;
    const matchedModule = modules?.find((item) => item.id === lessonId);
    const destination = matchedModule
      ? learningModuleHref(lessonId, matchedModule.section_number)
      : "/learn";
    router.replace(
      studyPlanTaskId && matchedModule
        ? `${destination}?studyPlanTaskId=${encodeURIComponent(studyPlanTaskId)}`
        : destination,
    );
  }, [isLoading, lessonId, modules, router, studyPlanTaskId]);

  return <LearningLessonPageSkeleton />;
}
