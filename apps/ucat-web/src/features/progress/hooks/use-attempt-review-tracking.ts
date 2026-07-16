"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AttemptReviewState,
  AttemptReviewType,
} from "@/features/progress/model/attempt-review";

async function requestReview(
  attemptType: AttemptReviewType,
  attemptId: string,
  method: "PUT" | "PATCH",
  body: unknown,
) {
  const response = await fetch(
    `/api/ucat/attempt-reviews/${attemptType}/${attemptId}`,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const result = (await response.json()) as AttemptReviewState & {
    error?: string;
  };
  if (!response.ok) throw new Error(result.error ?? "Could not update review.");
  return result;
}

export function findNextUnviewedReviewQuestion(input: {
  requiredQuestionIds: string[];
  viewedQuestionIds: string[];
  selectedQuestionId: string | null;
}): string | null {
  const viewed = new Set(input.viewedQuestionIds);
  const selectedIndex = input.selectedQuestionId
    ? input.requiredQuestionIds.indexOf(input.selectedQuestionId)
    : -1;

  for (
    let offset = 1;
    offset <= input.requiredQuestionIds.length;
    offset += 1
  ) {
    const index = (selectedIndex + offset) % input.requiredQuestionIds.length;
    const questionId = input.requiredQuestionIds[index];
    if (questionId && !viewed.has(questionId)) return questionId;
  }

  return null;
}

export function useAttemptReviewTracking(input: {
  attemptType: AttemptReviewType;
  attemptId: string;
  requiredQuestionIds: string[];
  selectedQuestionId: string | null;
  ready: boolean;
}) {
  const [review, setReview] = useState<AttemptReviewState | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedKey = useRef<string | null>(null);
  const sentViews = useRef(new Set<string>());
  const viewQueue = useRef(Promise.resolve());
  const requiredKey = input.requiredQuestionIds.join(",");

  useEffect(() => {
    if (!input.ready) return;
    const key = `${input.attemptType}:${input.attemptId}:${requiredKey}`;
    if (startedKey.current === key) return;
    startedKey.current = key;
    setIsPending(true);
    void requestReview(input.attemptType, input.attemptId, "PUT", {
      requiredQuestionIds: input.requiredQuestionIds,
    })
      .then((state) => {
        setReview(state);
        sentViews.current = new Set(state.viewedQuestionIds);
        setError(null);
      })
      .catch((caught) => {
        startedKey.current = null;
        setError(
          caught instanceof Error ? caught.message : "Could not start review.",
        );
      })
      .finally(() => setIsPending(false));
  }, [
    input.attemptId,
    input.attemptType,
    input.ready,
    input.requiredQuestionIds,
    requiredKey,
  ]);

  useEffect(() => {
    const questionId = input.selectedQuestionId;
    if (
      !review ||
      review.completedAt ||
      !questionId ||
      !input.requiredQuestionIds.includes(questionId) ||
      sentViews.current.has(questionId)
    )
      return;
    sentViews.current.add(questionId);
    setReview((current) =>
      current && !current.viewedQuestionIds.includes(questionId)
        ? {
            ...current,
            viewedQuestionIds: [...current.viewedQuestionIds, questionId],
          }
        : current,
    );
    viewQueue.current = viewQueue.current.then(async () => {
      try {
        setReview(
          await requestReview(input.attemptType, input.attemptId, "PATCH", {
            action: "view",
            questionId,
          }),
        );
      } catch {
        sentViews.current.delete(questionId);
        setReview((current) =>
          current
            ? {
                ...current,
                viewedQuestionIds: current.viewedQuestionIds.filter(
                  (id) => id !== questionId,
                ),
              }
            : current,
        );
      }
    });
  }, [
    input.attemptId,
    input.attemptType,
    input.requiredQuestionIds,
    input.selectedQuestionId,
    review,
  ]);

  const completeManually = useCallback(async () => {
    setIsPending(true);
    try {
      const state = await requestReview(
        input.attemptType,
        input.attemptId,
        "PATCH",
        {
          action: "complete",
        },
      );
      setReview(state);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not mark this attempt as reviewed.",
      );
    } finally {
      setIsPending(false);
    }
  }, [input.attemptId, input.attemptType]);

  const nextUnviewedQuestionId = review
    ? findNextUnviewedReviewQuestion({
        requiredQuestionIds: review.requiredQuestionIds,
        viewedQuestionIds: review.viewedQuestionIds,
        selectedQuestionId: input.selectedQuestionId,
      })
    : null;

  return {
    review,
    isPending,
    error,
    nextUnviewedQuestionId,
    completeManually,
  };
}
