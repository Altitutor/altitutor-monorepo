"use client";

import React from "react";
import { Skeleton } from "@altitutor/ui";
import { useActiveExamAttempt } from "@/features/exam-attempts/context/active-exam-attempt-context";
import { PracticeSessionPage } from "@/features/practice/components/practice-session-page";
import { QuestionEnginePage } from "@/features/question-engine";

export function ExamRoutePage() {
  const { active, isLoading } = useActiveExamAttempt();

  if (isLoading) {
    return (
      <div
        className="flex h-full min-h-0 flex-col gap-4 p-6"
        aria-label="Loading exam"
        aria-busy="true"
      >
        <Skeleton className="h-8 w-64" />
        <Skeleton className="min-h-0 flex-1 rounded-xl" />
      </div>
    );
  }

  if (active?.kind === "set" || active?.kind === "mock") {
    return (
      <QuestionEnginePage mode={active.kind} sourceId={active.resourceId} />
    );
  }

  return <PracticeSessionPage />;
}
