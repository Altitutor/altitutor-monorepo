import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InterviewReviewCommand, InterviewReviewMock, InterviewReviewTemplate, TutorInterviewReview, TutorInterviewReviewSummary } from "@altitutor/shared";
import { useAuthStore } from "@/shared/lib/supabase/auth";

export interface ReviewStudent { id: string; name: string }
export type ReviewTemplateSummary = Omit<InterviewReviewTemplate, "body">;

interface ReviewWorkspace {
  reviews: TutorInterviewReviewSummary[];
  templates: ReviewTemplateSummary[];
  students: ReviewStudent[];
}

const root = "/api/interviews/performance-reviews";

async function request<T>(path = "", init?: RequestInit): Promise<T> {
  const response = await fetch(root + path, { ...init, cache: "no-store" });
  const body: unknown = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(body && typeof body === "object" && "error" in body ? String(body.error) : "Unable to load performance reviews."), { status: response.status });
  }
  return body as T;
}

export function useInterviewReviewWorkspace(enabled: boolean) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["interview-review-workspace", userId],
    queryFn: () => request<ReviewWorkspace>(),
    enabled: enabled && !!userId,
    staleTime: 15_000,
    refetchOnMount: true,
  });
}

export function useInterviewReviewMocks(studentId: string | null) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["interview-review-mocks", userId, studentId],
    queryFn: () => request<InterviewReviewMock[]>(`?student=${encodeURIComponent(studentId ?? "")}`),
    enabled: Boolean(userId && studentId),
    staleTime: 0,
    refetchOnMount: true,
  });
}

function useReviewRecord<T>(kind: "review" | "template", id: string | undefined) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["interview-review-record", userId, kind, id],
    queryFn: () => request<T>(`?${kind}=${encodeURIComponent(id ?? "")}`),
    enabled: Boolean(userId && id),
    staleTime: 0,
    refetchOnMount: true,
    retry: (count, error) => !("status" in error && [403, 404].includes(Number(error.status))) && count < 2,
  });
}

export function useInterviewReview(id?: string) {
  return useReviewRecord<TutorInterviewReview>("review", id);
}

export function useInterviewReviewTemplate(id?: string) {
  return useReviewRecord<InterviewReviewTemplate>("template", id);
}

export function readInterviewReviewTemplate(id: string) {
  return request<InterviewReviewTemplate>(`?template=${encodeURIComponent(id)}`);
}

export function useInterviewReviewCommand() {
  const userId = useAuthStore((state) => state.user?.id);
  const client = useQueryClient();
  const retry = useRef<{ payload: string; commandId: string } | null>(null);
  const mutation = useMutation({
    mutationFn: (command: InterviewReviewCommand & { commandId: string }) => request<{ id: string; version: number }>("", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    }),
    onSuccess: async (_, command) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["interview-review-workspace", userId] }),
        client.invalidateQueries({ queryKey: ["interview-review-record", userId, command.type === "saveTemplate" ? "template" : "review", command.id] }),
      ]);
    },
  });
  return {
    isPending: mutation.isPending,
    mutateAsync: async (command: InterviewReviewCommand) => {
      const payload = JSON.stringify(command);
      const commandId = retry.current?.payload === payload ? retry.current.commandId : crypto.randomUUID();
      retry.current = { payload, commandId };
      const result = await mutation.mutateAsync({ ...command, commandId });
      retry.current = null;
      return result;
    },
  };
}
