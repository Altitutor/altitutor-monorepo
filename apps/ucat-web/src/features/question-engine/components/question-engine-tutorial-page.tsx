"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QuestionEnginePage } from "@/features/question-engine/components/question-engine-page";
import type { QuestionEngineQuestion } from "@/features/question-engine/model/types";
import { useOnboardingProgress } from "@/features/onboarding/hooks/use-onboarding-progress";
import { UCAT_QUESTION_ENGINE_TOUR } from "@/features/onboarding/config/tour-steps";

const TUTORIAL_QUESTIONS: QuestionEngineQuestion[] = [
  {
    id: "tutorial-question-1",
    stemId: "tutorial-stem-1",
    sectionName: "Question engine tutorial",
    sectionDisplayColumns: 1,
    stemText: "Use this example to become familiar with the question engine.",
    questionText: "Which number comes next in the sequence 2, 4, 6, 8?",
    questionType: "multiple_choice",
    options: [
      { id: "tutorial-1-a", index: 0, text: "9", isAnswer: false },
      { id: "tutorial-1-b", index: 1, text: "10", isAnswer: true },
      { id: "tutorial-1-c", index: 2, text: "11", isAnswer: false },
      { id: "tutorial-1-d", index: 3, text: "12", isAnswer: false },
    ],
  },
  {
    id: "tutorial-question-2",
    stemId: "tutorial-stem-2",
    sectionName: "Question engine tutorial",
    sectionDisplayColumns: 1,
    stemText: "This second question makes Previous and Next available.",
    questionText: "Which word is closest in meaning to brief?",
    questionType: "multiple_choice",
    options: [
      { id: "tutorial-2-a", index: 0, text: "Concise", isAnswer: true },
      { id: "tutorial-2-b", index: 1, text: "Distant", isAnswer: false },
      { id: "tutorial-2-c", index: 2, text: "Uncertain", isAnswer: false },
      { id: "tutorial-2-d", index: 3, text: "Detailed", isAnswer: false },
    ],
  },
];

function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}

export function QuestionEngineTutorialPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading, isCompleted } = useOnboardingProgress();
  const returnTo = safeReturnPath(searchParams.get("returnTo"));

  useEffect(() => {
    if (!isLoading && isCompleted(UCAT_QUESTION_ENGINE_TOUR)) {
      router.replace(returnTo);
    }
  }, [isLoading, isCompleted, router, returnTo]);

  return (
    <QuestionEnginePage
      mode="questions"
      standaloneQuestions={TUTORIAL_QUESTIONS}
      disableQuestionAttemptLogging
      tutorialMode
    />
  );
}
