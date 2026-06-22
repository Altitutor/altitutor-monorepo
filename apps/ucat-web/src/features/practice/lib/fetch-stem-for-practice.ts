"use client";

import type { QuestionStemWithQuestions } from "@/features/question-engine/model/types";

/**
 * Loads stems via the practice API (server-side student view).
 * Same mapping as set/mock engine; avoids brittle sessionStorage snapshots.
 */
export async function fetchStemsForPracticeSession(
  stemIds: string[],
): Promise<QuestionStemWithQuestions[]> {
  if (stemIds.length === 0) {
    return [];
  }

  const response = await fetch("/api/ucat/practice-stems/by-ids", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stemIds }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error ?? "Unable to load question stems");
  }

  const data = (await response.json()) as {
    stems: QuestionStemWithQuestions[];
  };

  return data.stems ?? [];
}

/**
 * Loads a single stem for standalone practice (learn block, direct stem URL).
 */
export async function fetchStemForPracticeSession(
  stemId: string,
): Promise<QuestionStemWithQuestions> {
  const stems = await fetchStemsForPracticeSession([stemId]);
  const stem = stems[0];
  if (!stem) {
    throw new Error("Unable to load question stem");
  }
  return stem;
}
