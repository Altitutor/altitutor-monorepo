"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getStudentUcatSessions,
  getStudentUcatSessionResources,
} from "@/features/sessions/api/sessions-api";

export function useStudentUcatSessions() {
  return useQuery({
    queryKey: ["ucat", "student-sessions"],
    queryFn: getStudentUcatSessions,
  });
}

export function useStudentUcatSessionResources(sessionId: string | null) {
  return useQuery({
    queryKey: ["ucat", "student-session-resources", sessionId],
    queryFn: () => getStudentUcatSessionResources(sessionId as string),
    enabled: !!sessionId,
  });
}
