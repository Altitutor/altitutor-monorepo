"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAttemptedMockIds,
  getMockAttemptsWithBreakdown,
  getStudentMocks,
} from "@/features/mocks/api/mocks-api";

export function useMocks() {
  return useQuery({
    queryKey: ["ucat", "student-mocks"],
    queryFn: getStudentMocks,
  });
}

export function useAttemptedMockIds() {
  return useQuery({
    queryKey: ["ucat", "attempted-mock-ids"],
    queryFn: getAttemptedMockIds,
  });
}

export function useMockAttemptsWithBreakdown(mockId: string | null) {
  return useQuery({
    queryKey: ["ucat", "mock-attempts", mockId],
    queryFn: () =>
      mockId ? getMockAttemptsWithBreakdown(mockId) : Promise.resolve([]),
    enabled: !!mockId,
  });
}
