import { useQuery } from "@tanstack/react-query";
import type { ResponseSnapshotV1 } from "@altitutor/ucat-response-contract";
import { api } from "@/lib/api";
import type {
  QuestionEngineExam,
  QuestionStemWithQuestions,
} from "@/features/question-engine/model/types";
import type { AttemptRecentPerformance } from "@/features/progress/attempt-insights";
import type { Attempt } from "@/features/dashboard/api";
export type AttemptKind = "practice" | "set" | "mock";
export type AttemptQuestion = {
  questionId: string;
  questionNumber: number;
  stemIndex: number;
  setIndex?: number;
  result: "correct" | "partial" | "incorrect" | "not_attempted";
  score: number | null;
  timeSpentSeconds: number | null;
  averageTimeSeconds: number | null;
  averageTimeSampleSize: number;
  timeBurdenSeconds: number | null;
  isFlagged: boolean;
  categoryName: string | null;
  answerSnapshot: ResponseSnapshotV1 | null;
};
export type AttemptDetail = {
  id: string;
  questionSetName?: string | null;
  mockName?: string | null;
  sectionName?: string | null;
  attemptedAt: string;
  completedAt: string | null;
  scorePoints?: number | null;
  totalPoints?: number | null;
  scaledScore?: number | null;
  scaledScoreMax?: number | null;
  timeTakenSeconds?: number | null;
  setTimeLimitSeconds?: number | null;
  mockTimeLimitSeconds?: number | null;
  studentExamSpeed?: number | null;
  recentPerformance: AttemptRecentPerformance;
  sets?: {
    questionSetName: string | null;
    scorePoints: number | null;
    totalPoints: number | null;
    scaledScore: number | null;
  }[];
  exam?: QuestionEngineExam;
  stemsSnapshot?: QuestionStemWithQuestions[];
  questionAttempts: AttemptQuestion[];
};
export const attemptKind = (kind: string): AttemptKind =>
  kind === "mock" || kind === "set" ? kind : "practice";
export function useAttempt(kind: AttemptKind, id: string) {
  return useQuery({
    queryKey: ["review", kind, id],
    queryFn: () =>
      api<AttemptDetail>(
        `/progress/${kind === "practice" ? "practice-sessions" : kind === "mock" ? "mock-attempts" : "set-attempts"}/${encodeURIComponent(id)}`,
      ),
  });
}
export function fetchAttempts(
  source: AttemptKind,
  page: number,
  sectionNumber?: string,
) {
  const params = new URLSearchParams({
    source,
    completedOnly: "true",
    page: String(page),
    pageSize: "10",
  });
  if (sectionNumber) params.set("sectionNumber", sectionNumber);
  return api<{ attempts: Attempt[]; total: number }>(
    `/progress/attempts?${params}`,
  );
}
