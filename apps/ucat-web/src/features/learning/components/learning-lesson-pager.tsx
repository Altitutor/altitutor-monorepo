"use client";

import { useLearnQuotaGate } from "@/features/learning/hooks/use-learn-quota-gate";
import type { LessonNavEntry } from "@/features/learning/lib/flatten-lessons-for-nav";
import { getLearningModuleIcon } from "@/features/learning/lib/learning-module-icons";
import { UcatClickableCardLink } from "@/shared/components/ucat-clickable-card";

type LearningLessonPagerProps = {
  next: LessonNavEntry | null;
};

export function LearningLessonPager({ next }: LearningLessonPagerProps) {
  const { guardLessonClick } = useLearnQuotaGate();

  if (!next) return null;

  return (
    <nav aria-label="Lesson navigation">
      <UcatClickableCardLink
        href={next.href}
        onClick={(event) => guardLessonClick(event, next)}
        layout="inline"
        icon={getLearningModuleIcon(next.icon_key)}
        title={next.label}
        description="Next module"
        titleClassName="text-sm"
        className="p-4"
      />
    </nav>
  );
}
