"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { skillTrainerApi } from "@/features/skill-trainer/api/skill-trainer-api";
import type { SkillTrainerAttemptState } from "@/features/skill-trainer/types/attempt";

const ACTIVE_SKILL_TRAINER_ATTEMPT_QUERY_KEY = [
  "skill-trainers",
  "active-attempt",
] as const;

type ActiveSkillTrainerAttemptContextValue = {
  active: SkillTrainerAttemptState | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  setLocal: (attempt: SkillTrainerAttemptState) => void;
  clearLocal: () => void;
};

const ActiveSkillTrainerAttemptContext =
  createContext<ActiveSkillTrainerAttemptContextValue | null>(null);

export function ActiveSkillTrainerAttemptProvider({
  children,
}: {
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [localActive, setLocalActive] =
    useState<SkillTrainerAttemptState | null>(null);
  const [completedNotice, setCompletedNotice] =
    useState<SkillTrainerAttemptState | null>(null);
  const query = useQuery({
    queryKey: ACTIVE_SKILL_TRAINER_ATTEMPT_QUERY_KEY,
    queryFn: () => skillTrainerApi.getActiveAttempt(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!query.data) return;

    setLocalActive(query.data);
    setCompletedNotice(query.data.isCompleted ? query.data : null);
  }, [query.data]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ACTIVE_SKILL_TRAINER_ATTEMPT_QUERY_KEY,
    });
  }, [queryClient]);

  const setLocal = useCallback(
    (attempt: SkillTrainerAttemptState) => {
      setLocalActive(attempt);
      setCompletedNotice(attempt.isCompleted ? attempt : null);
      queryClient.setQueryData(ACTIVE_SKILL_TRAINER_ATTEMPT_QUERY_KEY, attempt);
    },
    [queryClient],
  );

  const clearLocal = useCallback(() => {
    setLocalActive(null);
    setCompletedNotice(null);
    queryClient.setQueryData(ACTIVE_SKILL_TRAINER_ATTEMPT_QUERY_KEY, null);
  }, [queryClient]);

  const value = useMemo(
    () => ({
      active: query.data ?? localActive ?? completedNotice,
      isLoading: query.isLoading,
      refresh,
      setLocal,
      clearLocal,
    }),
    [
      query.data,
      localActive,
      completedNotice,
      query.isLoading,
      refresh,
      setLocal,
      clearLocal,
    ],
  );

  return (
    <ActiveSkillTrainerAttemptContext.Provider value={value}>
      {children}
    </ActiveSkillTrainerAttemptContext.Provider>
  );
}

export function useActiveSkillTrainerAttempt() {
  const ctx = useContext(ActiveSkillTrainerAttemptContext);
  if (!ctx) {
    throw new Error(
      "useActiveSkillTrainerAttempt must be used within ActiveSkillTrainerAttemptProvider",
    );
  }
  return ctx;
}
