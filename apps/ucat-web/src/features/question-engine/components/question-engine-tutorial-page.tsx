"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QuestionEnginePage } from "@/features/question-engine/components/question-engine-page";
import type { QuestionEngineQuestion } from "@/features/question-engine/model/types";
import { useOnboardingProgress } from "@/features/onboarding/hooks/use-onboarding-progress";
import { UCAT_QUESTION_ENGINE_TOUR } from "@/features/onboarding/config/tour-steps";
import { QuestionEngineTutorialInteractions } from "@/features/question-engine/components/question-engine-tutorial-interactions";

const TUTORIAL_QUESTIONS: QuestionEngineQuestion[] = [
  {
    id: "tutorial-question-1",
    stemId: "tutorial-stem-1",
    sectionName: "Question interface tutorial",
    sectionDisplayColumns: 2,
    stemText:
      "Urban trees reduce summer temperatures by shading buildings and releasing water vapour. They also provide habitats for birds and insects. However, young trees require regular watering and protection while they become established.",
    questionText: "Which statement is best supported by the passage?",
    responseType: "multiple_choice",
    answerScheme: "single_choice",
    options: [
      {
        id: "tutorial-1-a",
        index: 0,
        text: "Urban trees need no maintenance.",
        answerKeyValue: null,
      },
      {
        id: "tutorial-1-b",
        index: 1,
        text: "Urban trees can cool their surroundings.",
        answerKeyValue: "correct",
      },
      {
        id: "tutorial-1-c",
        index: 2,
        text: "Only mature trees provide habitats.",
        answerKeyValue: null,
      },
      {
        id: "tutorial-1-d",
        index: 3,
        text: "Trees increase summer temperatures.",
        answerKeyValue: null,
      },
    ],
  },
  {
    id: "tutorial-question-2",
    stemId: "tutorial-stem-2",
    sectionName: "Question interface tutorial",
    sectionDisplayColumns: 2,
    stemText:
      "Marine biologists use acoustic tags to follow the movement of fish. Receivers placed along the coast record a tagged fish whenever it swims nearby. The resulting data helps researchers identify feeding grounds and migration routes, although it cannot show where a fish travels between receivers.",
    questionText: "Which limitation of acoustic tagging is stated?",
    responseType: "multiple_choice",
    answerScheme: "single_choice",
    options: [
      {
        id: "tutorial-2-a",
        index: 0,
        text: "Tags cannot identify feeding grounds.",
        answerKeyValue: null,
      },
      {
        id: "tutorial-2-b",
        index: 1,
        text: "Receivers only work offshore.",
        answerKeyValue: null,
      },
      {
        id: "tutorial-2-c",
        index: 2,
        text: "Movement between receivers is not recorded.",
        answerKeyValue: "correct",
      },
      {
        id: "tutorial-2-d",
        index: 3,
        text: "Each fish requires several tags.",
        answerKeyValue: null,
      },
    ],
  },
];

function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}

export function QuestionEngineTutorialPage({
  tourId = UCAT_QUESTION_ENGINE_TOUR,
}: {
  tourId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading, isError, isCompleted } = useOnboardingProgress();
  const returnTo = safeReturnPath(searchParams.get("returnTo"));
  const isReplay = searchParams.get("replay") === "1";
  const sawIncompleteReplayRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (isError) {
      router.replace(returnTo);
      return;
    }
    const completed = isCompleted(tourId);
    if (!completed) {
      sawIncompleteReplayRef.current = true;
      return;
    }
    if (!isReplay || sawIncompleteReplayRef.current) {
      router.replace(returnTo);
    }
  }, [isError, isReplay, isLoading, isCompleted, router, returnTo, tourId]);

  return (
    <>
      <QuestionEngineTutorialInteractions />
      <QuestionEnginePage
        mode="questions"
        standaloneQuestions={TUTORIAL_QUESTIONS}
        disableQuestionAttemptLogging
        tutorialMode
      />
    </>
  );
}
