"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAccessibleStudentSets,
  getAttemptedSetIds,
  getStudentSet,
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

export function useAccessibleSets() {
  return useQuery({
    queryKey: ["ucat", "accessible-student-sets"],
    queryFn: getAccessibleStudentSets,
  });
}

export function useSet(setId: string | null) {
  return useQuery({
    queryKey: ["ucat", "student-set", setId],
    queryFn: () => (setId ? getStudentSet(setId) : Promise.resolve(null)),
    enabled: !!setId,
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
