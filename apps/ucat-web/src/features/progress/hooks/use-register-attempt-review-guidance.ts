"use client";

import { useCallback, useEffect, useRef } from "react";
import type { AttemptReviewState } from "@/features/progress/model/attempt-review";
import { useStudyPlanCompanion } from "@/features/study-plan/context/study-plan-companion-context";
import { scrollToAttemptReviewQuestion } from "@/features/study-plan/lib/attempt-review-companion";

/** Publishes in-page review guidance to the Study orb while on a result screen. */
export function useRegisterAttemptReviewGuidance(input: {
  review: AttemptReviewState | null;
  selectedQuestionIndex: number;
  nextUnviewedQuestionId: string | null;
  questionAttempts: readonly { questionId: string }[] | null | undefined;
  setSelectedQuestionIndex: (index: number) => void;
}) {
  const { setAttemptReviewGuidance } = useStudyPlanCompanion();
  const landingQuestionIndexRef = useRef<number | null>(null);
  const startReviewing = useCallback(() => {
    const questionId = input.nextUnviewedQuestionId;
    const attempts = input.questionAttempts;
    if (!questionId || !attempts) return;
    scrollToAttemptReviewQuestion({
      questionId,
      questionAttempts: attempts,
      setSelectedQuestionIndex: input.setSelectedQuestionIndex,
    });
  }, [
    input.nextUnviewedQuestionId,
    input.questionAttempts,
    input.setSelectedQuestionIndex,
  ]);

  useEffect(() => {
    return () => setAttemptReviewGuidance(null);
  }, [setAttemptReviewGuidance]);

  useEffect(() => {
    const review = input.review;
    if (!review || review.completedAt || review.requiredQuestionIds.length === 0) {
      landingQuestionIndexRef.current = null;
      setAttemptReviewGuidance(null);
      return;
    }

    if (landingQuestionIndexRef.current === null) {
      landingQuestionIndexRef.current = input.selectedQuestionIndex;
    }

    const requiredCount = review.requiredQuestionIds.length;
    const viewedCount = review.requiredQuestionIds.filter((questionId) =>
      review.viewedQuestionIds.includes(questionId),
    ).length;
    const remainingCount = requiredCount - viewedCount;
    if (remainingCount === 0 || !input.nextUnviewedQuestionId) {
      setAttemptReviewGuidance(null);
      return;
    }

    setAttemptReviewGuidance({
      viewedCount,
      remainingCount,
      requiredCount,
      landingQuestionIndex: landingQuestionIndexRef.current,
      selectedQuestionIndex: input.selectedQuestionIndex,
      startReviewing,
    });
  }, [
    input.nextUnviewedQuestionId,
    input.review,
    input.selectedQuestionIndex,
    setAttemptReviewGuidance,
    startReviewing,
  ]);
}
