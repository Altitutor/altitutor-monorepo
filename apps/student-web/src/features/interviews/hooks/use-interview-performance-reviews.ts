import { useQuery } from "@tanstack/react-query";
import type { InterviewReviewSummary, StudentInterviewReview } from "@altitutor/shared";
import { useAuthStore } from "@/shared/lib/supabase/auth";

async function read<T>(id?: string): Promise<T> {
  const response = await fetch("/api/interviews/performance-reviews" + (id ? `?id=${encodeURIComponent(id)}` : ""), { cache: "no-store" });
  const body: unknown = await response.json();
  if (!response.ok) throw Object.assign(new Error("Unable to load performance reviews."), { status: response.status });
  return body as T;
}

export function useStudentInterviewReviews(enabled: boolean) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["interview-performance-reviews", userId],
    enabled: enabled && !!userId,
    queryFn: () => read<InterviewReviewSummary[]>(),
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useStudentInterviewReview(id: string | undefined, enabled: boolean, revision?: string) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["interview-performance-reviews", userId, id, revision],
    enabled: enabled && !!userId && !!id,
    queryFn: () => read<StudentInterviewReview>(id),
    staleTime: 0,
    refetchOnMount: true,
    retry: (count, error) => !("status" in error && [403, 404].includes(Number(error.status))) && count < 2,
  });
}
