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

type StudyPlanCompanionContextValue = {
  livePractice: StudyPlanLivePractice | null;
  activityComplete: boolean;
  activityCompletion: StudyPlanActivityCompletion | null;
  setActivityComplete: (complete: boolean) => void;
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
      setActivityComplete,
      reportActivityCompletion,
      consumeActivityCompletion,
      reportLivePractice,
      clearLivePractice,
    }),
    [
      activityComplete,
      activityCompletion,
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
