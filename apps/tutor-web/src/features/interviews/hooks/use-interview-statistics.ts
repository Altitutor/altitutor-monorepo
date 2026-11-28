"use client";

import { useQuery } from "@tanstack/react-query";

export interface InterviewScoredAttempt {
  roundId: string;
  interviewId: string;
  stationId: string | null;
  stationName: string;
  studentId: string;
  studentName: string;
  tutorId: string;
  tutorName: string;
  score: number;
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
  return useQuery({
    queryKey: ["interviews", "statistics"],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<InterviewStatistics> => {
      const response = await fetch("/api/interviews/statistics", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load interview statistics.");
      return response.json();
    },
  });
}
