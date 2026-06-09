"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LessonNavEntry } from "@/features/learning/lib/flatten-lessons-for-nav";

type LearningLessonPagerProps = {
  prev: LessonNavEntry | null;
  next: LessonNavEntry | null;
};

export function LearningLessonPager({ prev, next }: LearningLessonPagerProps) {
  if (!prev && !next) return null;

  const cardClass = cn(
    "group block min-w-0 rounded-lg border bg-card p-3 transition-all duration-300 ease-out",
    "hover:-translate-y-0.5 hover:shadow-md focus-within:-translate-y-0.5 focus-within:shadow-md",
  );

  const labelClass =
    "mt-1 block break-words text-xs font-medium leading-snug tracking-tight transition-colors duration-300 group-hover:text-primary";
  const eyebrowClass =
    "flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <nav aria-label="Lesson navigation" className="flex gap-3">
      {prev ? (
        <Link href={prev.href} className={cn(cardClass, "flex-1")}>
          <div className={eyebrowClass}>
            <ArrowLeft className="h-3 w-3 shrink-0 transition-transform duration-300 ease-out group-hover:-translate-x-0.5 group-hover:text-foreground" />
            <span>Previous</span>
          </div>
          <span className={labelClass}>{prev.label}</span>
        </Link>
      ) : null}

      {next ? (
        <Link href={next.href} className={cn(cardClass, "flex-1 text-right")}>
          <div className={cn(eyebrowClass, "justify-end")}>
            <span>Next</span>
            <ArrowRight className="h-3 w-3 shrink-0 transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:text-foreground" />
          </div>
          <span className={labelClass}>{next.label}</span>
        </Link>
      ) : null}
    </nav>
  );
}
