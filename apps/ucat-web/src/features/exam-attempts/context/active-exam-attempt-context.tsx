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
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";
import { fetchActiveExamAttempt } from "@/features/exam-attempts/api/exam-attempts-api";
import { isAttemptAtResults } from "@/features/exam-attempts/lib/banner-copy";
import { resolveActiveExamAttemptFromSources } from "@/features/exam-attempts/lib/active-exam-attempt-state";

type ActiveExamAttemptContextValue = {
  active: ActiveExamAttempt | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  setLocal: (attempt: ActiveExamAttempt) => void;
  updateLocal: (
    attemptId: string,
    patch: Partial<ActiveExamAttempt>,
  ) => void;
  clearLocal: () => void;
};

const ActiveExamAttemptContext =
  createContext<ActiveExamAttemptContextValue | null>(null);

export function ActiveExamAttemptProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [localActive, setLocalActive] = useState<ActiveExamAttempt | null>(null);
  const [completedNotice, setCompletedNotice] =
    useState<ActiveExamAttempt | null>(null);
  const query = useQuery({
    queryKey: ["ucat", "active-exam-attempt"],
    queryFn: fetchActiveExamAttempt,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (query.data && isAttemptAtResults(query.data)) {
      setLocalActive(query.data);
      setCompletedNotice(query.data);
    } else if (query.data) {
      setLocalActive(query.data);
      setCompletedNotice(null);
    } else if (query.data === null) {
      // Successful empty fetch must drop stale local/completed fallbacks.
      setLocalActive(null);
      setCompletedNotice(null);
    }
  }, [query.data]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["ucat", "active-exam-attempt"],
    });
  }, [queryClient]);

  const clearLocal = useCallback(() => {
    setLocalActive(null);
    setCompletedNotice(null);
    queryClient.setQueryData(["ucat", "active-exam-attempt"], null);
  }, [queryClient]);

  const setLocal = useCallback(
    (attempt: ActiveExamAttempt) => {
      setLocalActive(attempt);
      queryClient.setQueryData(["ucat", "active-exam-attempt"], attempt);
    },
    [queryClient],
  );

  const updateLocal = useCallback(
    (attemptId: string, patch: Partial<ActiveExamAttempt>) => {
      setLocalActive((current) =>
        current?.attemptId === attemptId ? { ...current, ...patch } : current,
      );
      queryClient.setQueryData<ActiveExamAttempt | null>(
        ["ucat", "active-exam-attempt"],
        (current) =>
          current?.attemptId === attemptId ? { ...current, ...patch } : current,
      );
    },
    [queryClient],
  );

  const active = resolveActiveExamAttemptFromSources({
    queryData: query.data,
    localActive,
    completedNotice,
  });

  const value = useMemo(
    () => ({
      active,
      isLoading: query.isLoading,
      refresh,
      setLocal,
      updateLocal,
      clearLocal,
    }),
    [
      active,
      query.isLoading,
      refresh,
      setLocal,
      updateLocal,
      clearLocal,
    ],
  );

  return (
    <ActiveExamAttemptContext.Provider value={value}>
      {children}
    </ActiveExamAttemptContext.Provider>
  );
}

export function useActiveExamAttempt() {
  const ctx = useContext(ActiveExamAttemptContext);
  if (!ctx) {
    throw new Error(
      "useActiveExamAttempt must be used within ActiveExamAttemptProvider",
    );
  }
  return ctx;
}
