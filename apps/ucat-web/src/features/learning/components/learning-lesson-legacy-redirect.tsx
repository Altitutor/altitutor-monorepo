"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LearningLessonPageSkeleton } from "@/features/learning/components/learning-lesson-page-skeleton";
import { useLearningModules } from "@/features/learning/hooks/use-learning";
import { learningModuleHref } from "@/features/learning/lib/learning-module-href";

export function LearningLessonLegacyRedirect({
  lessonId,
}: {
  lessonId: string;
}) {
  const router = useRouter();
  const { data: modules, isLoading } = useLearningModules();

  useEffect(() => {
    if (isLoading) return;
    const module = modules?.find((item) => item.id === lessonId);
    router.replace(
      module ? learningModuleHref(lessonId, module.section_number) : "/learn",
    );
  }, [isLoading, lessonId, modules, router]);

  return <LearningLessonPageSkeleton />;
}
