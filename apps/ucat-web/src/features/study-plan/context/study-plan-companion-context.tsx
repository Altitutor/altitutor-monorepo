"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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

type StudyPlanCompanionContextValue = {
  livePractice: StudyPlanLivePractice | null;
  activityComplete: boolean;
  setActivityComplete: (complete: boolean) => void;
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
      setActivityComplete,
      reportLivePractice,
      clearLivePractice,
    }),
    [activityComplete, clearLivePractice, livePractice, reportLivePractice],
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
