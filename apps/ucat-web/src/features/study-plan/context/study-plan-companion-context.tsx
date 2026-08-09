"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type StudyPlanLivePractice = {
  sessionId: string;
  studyPlanTaskId: string | null;
  title: string;
  answeredCount: number;
  currentQuestionNumber: number;
  targetUnits: number | null;
  totalQuestionLabel: string;
};

export type StudyPlanActivityCompletion = {
  id: number;
  title: string;
  detail?: string;
};

/** In-page review guidance registered by attempt result screens. */
export type AttemptReviewPageGuidance = {
  viewedCount: number;
  remainingCount: number;
  requiredCount: number;
  landingQuestionIndex: number;
  selectedQuestionIndex: number;
  startReviewing: () => void;
};

type StudyPlanCompanionContextValue = {
  livePractice: StudyPlanLivePractice | null;
  activityComplete: boolean;
  activityCompletion: StudyPlanActivityCompletion | null;
  attemptReviewGuidance: AttemptReviewPageGuidance | null;
  setActivityComplete: (complete: boolean) => void;
  setAttemptReviewGuidance: (
    guidance: AttemptReviewPageGuidance | null,
  ) => void;
  reportActivityCompletion: (
    completion: Omit<StudyPlanActivityCompletion, "id">,
  ) => void;
  consumeActivityCompletion: (id: number) => void;
  reportLivePractice: (activity: StudyPlanLivePractice) => void;
  clearLivePractice: (sessionId: string) => void;
};

const StudyPlanCompanionContext =
  createContext<StudyPlanCompanionContextValue | null>(null);

export function StudyPlanCompanionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [livePractice, setLivePractice] =
    useState<StudyPlanLivePractice | null>(null);
  const [activityComplete, setActivityComplete] = useState(false);
  const [activityCompletion, setActivityCompletion] =
    useState<StudyPlanActivityCompletion | null>(null);
  const [attemptReviewGuidance, setAttemptReviewGuidance] =
    useState<AttemptReviewPageGuidance | null>(null);
  const completionIdRef = useRef(0);
  const reportActivityCompletion = useCallback(
    (completion: Omit<StudyPlanActivityCompletion, "id">) => {
      completionIdRef.current += 1;
      setActivityCompletion({ id: completionIdRef.current, ...completion });
    },
    [],
  );
  const consumeActivityCompletion = useCallback((id: number) => {
    setActivityCompletion((current) => (current?.id === id ? null : current));
  }, []);
  const reportLivePractice = useCallback((activity: StudyPlanLivePractice) => {
    setLivePractice(activity);
  }, []);
  const clearLivePractice = useCallback((sessionId: string) => {
    setLivePractice((current) =>
      current?.sessionId === sessionId ? null : current,
    );
  }, []);
  const value = useMemo(
    () => ({
      livePractice,
      activityComplete,
      activityCompletion,
      attemptReviewGuidance,
      setActivityComplete,
      setAttemptReviewGuidance,
      reportActivityCompletion,
      consumeActivityCompletion,
      reportLivePractice,
      clearLivePractice,
    }),
    [
      activityComplete,
      activityCompletion,
      attemptReviewGuidance,
      clearLivePractice,
      consumeActivityCompletion,
      livePractice,
      reportActivityCompletion,
      reportLivePractice,
    ],
  );

  return (
    <StudyPlanCompanionContext.Provider value={value}>
      {children}
    </StudyPlanCompanionContext.Provider>
  );
}

export function useStudyPlanCompanion() {
  const value = useContext(StudyPlanCompanionContext);
  if (!value) {
    throw new Error(
      "useStudyPlanCompanion must be used inside StudyPlanCompanionProvider",
    );
  }
  return value;
}
