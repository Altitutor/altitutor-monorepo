import { loadInterviewRoundHistory, type InterviewRoundListSnapshot, type InterviewRoundHistoryPage } from "@altitutor/shared";
import type {
  StudentInterviewRoundSummary,
  InterviewCommand,
  InterviewCommandResult,
  StudentInterviewRound,
} from "@altitutor/shared";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/interviews${path}`, {
    ...init,
    cache: "no-store",
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof body === "object" && body && "error" in body
        ? String(body.error)
        : "Unable to load interviews. Please try again.";
    throw Object.assign(new Error(message), { status: response.status });
  }
  return body as T;
}

export const getInterviewAccess = () =>
  request<{ hasAccess: boolean }>("/access");
export const getInterviewRounds = () =>
  request<StudentInterviewRoundSummary[]>("/rounds?summary=1");
export const getCurrentInterviewRounds = (signal: AbortSignal) =>
  request<InterviewRoundListSnapshot<StudentInterviewRoundSummary>>("/rounds?summary=1&collection=current", { signal });
export const getInterviewRoundHistory = (signal: AbortSignal) =>
  loadInterviewRoundHistory<StudentInterviewRoundSummary>((cursor) => request<InterviewRoundHistoryPage<StudentInterviewRoundSummary>>(
    `/rounds?summary=1&collection=history${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { signal },
  ));
export const getInterviewRound = (id: string) =>
  request<StudentInterviewRound>(`/rounds/${encodeURIComponent(id)}`);
export const interviewRecordingSource = (roundId: string, recordingId: string) =>
  `/api/interviews/rounds/${encodeURIComponent(roundId)}/recordings/${encodeURIComponent(recordingId)}?format=media`;
export const sendInterviewCommand = (command: InterviewCommand) =>
  request<InterviewCommandResult>("/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
