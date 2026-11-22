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
/** Metadata lives in the actor-scoped query entry, never a global content cache. */
export type LiveInterviewRound = InterviewRound & {
  actorId?: string;
  contentRevision?: string;
};
interface LiveRoundResponse {
  actorId: string;
  contentRevision: string;
  round: Omit<InterviewRound, "stations">;
  stations: InterviewRound["stations"] | null;
}
export async function getLiveInterviewRound(id: string, previous?: LiveInterviewRound): Promise<LiveInterviewRound> {
  const revision = previous?.id === id ? previous.contentRevision : undefined;
  const read = (contentRevision?: string) => request<LiveRoundResponse>(
    `/rounds/${encodeURIComponent(id)}?live=1${contentRevision ? `&contentRevision=${encodeURIComponent(contentRevision)}` : ""}`,
  );
  const assemble = (value: LiveRoundResponse, allowCached = true): LiveInterviewRound | null => {
    if (value.round?.id !== id || typeof value.actorId !== "string" || typeof value.contentRevision !== "string")
      throw new Error("Unable to load the current interview state.");
    const stations = value.stations ?? (
      allowCached && previous?.id === id && previous.actorId === value.actorId && previous.contentRevision === value.contentRevision
        ? previous.stations : undefined
    );
    return Array.isArray(stations) ? { ...value.round, stations, actorId: value.actorId, contentRevision: value.contentRevision } : null;
  };
  const value = await read(revision);
  const round = assemble(value);
  if (round) return round;
  // A removed/replaced cache entry cannot hydrate a partial response. Request
  // authoritative content once; never combine an unmatched revision or actor.
  const complete = assemble(await read(), false);
  if (!complete) throw new Error("Unable to load interview station content. Please retry.");
  return complete;
}
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
