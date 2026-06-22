"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";
import { fetchActiveExamAttempt } from "@/features/exam-attempts/api/exam-attempts-api";

type ActiveExamAttemptContextValue = {
  active: ActiveExamAttempt | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  clearLocal: () => void;
};

const ActiveExamAttemptContext =
  createContext<ActiveExamAttemptContextValue | null>(null);

export function ActiveExamAttemptProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["ucat", "active-exam-attempt"],
    queryFn: fetchActiveExamAttempt,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["ucat", "active-exam-attempt"],
    });
  }, [queryClient]);

  const clearLocal = useCallback(() => {
    queryClient.setQueryData(["ucat", "active-exam-attempt"], null);
  }, [queryClient]);

  const value = useMemo(
    () => ({
      active: query.data ?? null,
      isLoading: query.isLoading,
      refresh,
      clearLocal,
    }),
    [query.data, query.isLoading, refresh, clearLocal],
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
