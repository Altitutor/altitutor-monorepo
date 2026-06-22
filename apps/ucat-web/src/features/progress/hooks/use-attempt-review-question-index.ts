"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const QUESTION_PARAM = "q";

function parseQuestionIndex(
  raw: string | null,
  questionCount: number,
): number {
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 0;
  const index = parsed - 1;
  const maxIndex = Math.max(0, questionCount - 1);
  return Math.min(Math.max(0, index), maxIndex);
}

export function useAttemptReviewQuestionIndex(questionCount: number) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const indexFromUrl = useMemo(
    () => parseQuestionIndex(searchParams.get(QUESTION_PARAM), questionCount),
    [searchParams, questionCount],
  );

  const [selectedQuestionIndex, setSelectedQuestionIndexState] =
    useState(indexFromUrl);

  useEffect(() => {
    setSelectedQuestionIndexState(indexFromUrl);
  }, [indexFromUrl]);

  const setSelectedQuestionIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(
        0,
        Math.min(index, Math.max(0, questionCount - 1)),
      );

      setSelectedQuestionIndexState(clamped);

      const params = new URLSearchParams(searchParams.toString());
      if (clamped <= 0) {
        params.delete(QUESTION_PARAM);
      } else {
        params.set(QUESTION_PARAM, String(clamped + 1));
      }

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, questionCount, router, searchParams],
  );

  return {
    selectedQuestionIndex,
    setSelectedQuestionIndex,
  };
}
