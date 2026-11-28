"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/shared/lib/supabase/auth";
import { useInterviewAccess } from "./use-interview-access";

export interface InterviewScoredAttempt {
  roundId: string;
  interviewId: string;
  stationId: string | null;
  stationName: string;
  studentId: string;
  studentName: string;
  tutorId: string;
  tutorName: string;
  score: number | null;
  maximum: number;
  mockScore: number | null;
  mockMaximum: number | null;
}

export interface InterviewTutorStatistics {
  id: string;
  name: string;
  interviews: number;
  reviews: number;
  sessions: number;
}

interface InterviewStatistics {
  tutors: InterviewTutorStatistics[];
  attempts: InterviewScoredAttempt[];
}

export function useInterviewStatistics(enabled = true) {
  const userId = useAuthStore((state) => state.user?.id);
  const access = useInterviewAccess();
  const query = useQuery({
    queryKey: ["interviews", "statistics", userId],
    enabled: enabled && !!userId && access.data === true,
    staleTime: 0,
    queryFn: async (): Promise<InterviewStatistics> => {
      const response = await fetch("/api/interviews/statistics", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load interview statistics.");
      return response.json();
    },
  });
  return { ...query, data: access.data === true && !access.error ? query.data : undefined, access };
}
