"use client";

import type { QuestionEngineQuestion } from "@/features/question-engine/model/types";

export async function fetchQuestionForLearn(
  questionId: string,
  blockId: string,
): Promise<QuestionEngineQuestion> {
  const response = await fetch(
    `/api/ucat/learn/questions/${questionId}?blockId=${encodeURIComponent(blockId)}`,
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Unable to load question");
  }
  return response.json() as Promise<QuestionEngineQuestion>;
}
