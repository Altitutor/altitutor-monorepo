"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completeSessionResource,
  getCompletedSessionResourceIds,
  getStudentUcatSessions,
  getStudentUcatSessionResources,
} from "@/features/sessions/api/sessions-api";

export function useStudentUcatSessions() {
  return useQuery({
    queryKey: ["ucat", "student-sessions"],
    queryFn: getStudentUcatSessions,
  });
}

export function useCompletedSessionResourceIds() {
  return useQuery({
    queryKey: ["ucat", "student-session-resource-progress"],
    queryFn: getCompletedSessionResourceIds,
  });
}

export function useCompleteSessionResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeSessionResource,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["ucat", "student-session-resource-progress"],
      }),
  });
}

export function useStudentUcatSessionResources(sessionId: string | null) {
  return useQuery({
    queryKey: ["ucat", "student-session-resources", sessionId],
    queryFn: () => getStudentUcatSessionResources(sessionId as string),
    enabled: !!sessionId,
  });
}
