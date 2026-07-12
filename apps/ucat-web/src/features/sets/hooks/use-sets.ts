"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAttemptedSetIds,
  getSetAttempts,
  getSetQuestionCount,
  getStudentSets,
} from "@/features/sets/api/sets-api";

export function useSets() {
  return useQuery({
    queryKey: ["ucat", "student-sets"],
    queryFn: getStudentSets,
  });
}

export function useAttemptedSetIds() {
  return useQuery({
    queryKey: ["ucat", "attempted-set-ids"],
    queryFn: getAttemptedSetIds,
  });
}

export function useSetAttempts(setId: string | null) {
  return useQuery({
    queryKey: ["ucat", "set-attempts", setId],
    queryFn: () => (setId ? getSetAttempts(setId) : Promise.resolve([])),
    enabled: !!setId,
  });
}

export function useSetQuestionCount(setId: string | null) {
  return useQuery({
    queryKey: ["ucat", "set-question-count", setId],
    queryFn: () =>
      setId ? getSetQuestionCount(setId) : Promise.resolve(0),
    enabled: !!setId,
  });
}
