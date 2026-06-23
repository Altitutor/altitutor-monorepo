"use client";

import { useEffect, useRef, useState } from "react";
import type { QuestionStemWithQuestions } from "@/features/question-engine/model/types";
import { fetchStemsForPracticeSession } from "@/features/practice/lib/fetch-stem-for-practice";

function splitStemIdsKey(key: string): string[] {
  return key.length > 0 ? key.split("\0") : [];
}

/**
 * Loads full stem JSON via the practice API (same path as set/mock detail).
 * Fetches once per stem-id set; appends incrementally for unlimited mode.
 */
export function useHydratedQuestionStems(
  questionStems: QuestionStemWithQuestions[] | undefined,
): {
  stems: QuestionStemWithQuestions[] | undefined;
  isLoading: boolean;
} {
  const [stems, setStems] = useState<QuestionStemWithQuestions[] | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState(false);
  const lastFetchedKeyRef = useRef<string | null>(null);
  const questionStemsRef = useRef(questionStems);
  questionStemsRef.current = questionStems;

  const stemIdsKey =
    questionStems?.map((stem) => stem.id).join("\0") ?? "";

  useEffect(() => {
    const currentStems = questionStemsRef.current;
    if (!stemIdsKey || !currentStems?.length) {
      setStems(undefined);
      lastFetchedKeyRef.current = null;
      setIsLoading(false);
      return;
    }

    if (lastFetchedKeyRef.current === stemIdsKey) {
      return;
    }

    const previousKey = lastFetchedKeyRef.current;
    const previousIds = previousKey ? splitStemIdsKey(previousKey) : [];
    const nextIds = splitStemIdsKey(stemIdsKey);
    const isAppend =
      previousIds.length > 0 &&
      stemIdsKey.startsWith(`${previousKey}\0`);
    const idsToFetch = isAppend
      ? nextIds.slice(previousIds.length)
      : nextIds;

    if (idsToFetch.length === 0) {
      return;
    }

    let cancelled = false;
    const isInitialLoad = previousKey === null;
    if (isInitialLoad) {
      setIsLoading(true);
    }

    void fetchStemsForPracticeSession(idsToFetch)
      .then((fetched) => {
        if (cancelled) return;
        lastFetchedKeyRef.current = stemIdsKey;
        setStems((prev) => {
          if (isAppend && prev) {
            return [...prev, ...fetched];
          }
          return fetched;
        });
      })
      .catch(() => {
        if (cancelled) return;
        lastFetchedKeyRef.current = stemIdsKey;
        setStems(questionStemsRef.current);
      })
      .finally(() => {
        if (!cancelled && isInitialLoad) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [stemIdsKey]);

  return { stems, isLoading };
}
