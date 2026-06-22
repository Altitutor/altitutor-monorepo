"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import { getRemainingSecondsFromEndsAt } from "@/lib/ucat/exam-attempt/timing";
import { formatTimeRemaining } from "@/features/question-engine/lib/timing";

export function ExamAttemptResumeBanner() {
  const { active } = useActiveExamAttempt();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active?.currentSegmentEndsAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active?.currentSegmentEndsAt]);

  if (!active) return null;

  const remaining = active.currentSegmentEndsAt
    ? getRemainingSecondsFromEndsAt(active.currentSegmentEndsAt)
    : null;

  return (
    <div className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            <span className="font-medium">Exam in progress:</span> {active.label}
            {remaining != null ? (
              <span className="ml-2 tabular-nums text-amber-800 dark:text-amber-200">
                ({formatTimeRemaining(remaining)} left)
              </span>
            ) : null}
          </span>
        </div>
        <Link
          href={active.resumeHref}
          className="inline-flex h-8 items-center rounded-md bg-amber-900 px-3 text-xs font-medium text-amber-50 hover:bg-amber-800 dark:bg-amber-100 dark:text-amber-950 dark:hover:bg-amber-200"
        >
          Resume
        </Link>
      </div>
    </div>
  );
}
