import { useQuery } from "@tanstack/react-query";
import type { InterviewReviewMock } from "@altitutor/shared";
import { useAuthStore } from "@/shared/lib/supabase/auth";

export interface InterviewStudentSummary {
  id: string;
  name: string;
  classIds: string[];
  mocks: InterviewReviewMock[];
  sessions: { id: string; name: string; startAt: string | null; attended: boolean | null }[];
}

export function useInterviewStudents(enabled: boolean) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["interview-students", userId],
    enabled: enabled && !!userId,
    staleTime: 0,
    queryFn: async (): Promise<InterviewStudentSummary[]> => {
      const response = await fetch("/api/interviews/students", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load interview students.");
      return response.json();
    },
  });
}
