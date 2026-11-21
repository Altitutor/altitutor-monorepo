import { loadInterviewRoundHistory, type InterviewRoundListSnapshot, type InterviewRoundHistoryPage } from "@altitutor/shared";
import type {
  InterviewCatalog,
  TutorInterviewRoundSummary,
  InterviewCommand,
  InterviewCommandResult,
  InterviewRound,
} from "@altitutor/shared";

async function request<T>(
  path: string,
  init?: RequestInit,
  fallback = "Unable to save interview changes.",
): Promise<T> {
  const response = await fetch(`/api/interviews${path}`, {
    ...init,
    cache: "no-store",
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof body === "object" && body && "error" in body
        ? String(body.error)
        : fallback;
    throw Object.assign(new Error(message), { status: response.status });
  }
  return body as T;
}
export type InterviewListCatalog = Pick<InterviewCatalog, "actorId" | "tutors"> & {
  interviews: Array<Pick<InterviewCatalog["interviews"][number], "id" | "name">>;
  students: Array<Pick<InterviewCatalog["students"][number], "id" | "name">>;
};
export const getInterviewCatalog = () => request<InterviewCatalog>("/catalog");
export const getInterviewListCatalog = () => request<InterviewListCatalog>("/catalog?summary=1");
export const getInterviewRounds = () => request<TutorInterviewRoundSummary[]>("/rounds?summary=1");
export const getCurrentInterviewRounds = (signal: AbortSignal) =>
  request<InterviewRoundListSnapshot<TutorInterviewRoundSummary>>("/rounds?summary=1&collection=current", { signal });
export const getInterviewRoundHistory = (signal: AbortSignal) =>
  loadInterviewRoundHistory<TutorInterviewRoundSummary>((cursor) => request<InterviewRoundHistoryPage<TutorInterviewRoundSummary>>(
    `/rounds?summary=1&collection=history${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { signal },
  ));
export const getInterviewRound = (id: string) =>
  request<InterviewRound>(`/rounds/${id}`);
export const sendInterviewCommand = (command: InterviewCommand) =>
  request<InterviewCommandResult>("/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
export const suggestInterviewStationName = (input: {
  prompt: string;
  questions: string[];
}) =>
  request<{ name: string }>(
    "/ai",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "station-name", ...input }),
    },
    "Unable to name this station.",
  );
export const suggestInterviewQuestionTags = (input: {
  prompt: string;
  question: string;
  tags: Array<{ id: string; name: string }>;
}) =>
  request<{ tagIds: string[] }>(
    "/ai",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "question-tags", ...input }),
    },
    "Unable to tag this question.",
  );
