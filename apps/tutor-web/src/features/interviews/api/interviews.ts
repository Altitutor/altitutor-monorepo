import type {
  InterviewCatalog,
  InterviewCommand,
  InterviewCommandResult,
  InterviewRound,
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
        : "Unable to save interview changes.";
    throw Object.assign(new Error(message), { status: response.status });
  }
  return body as T;
}
export const getInterviewCatalog = () => request<InterviewCatalog>("/catalog");
export const getInterviewRounds = () => request<InterviewRound[]>("/rounds");
export const getInterviewRound = (id: string) =>
  request<InterviewRound>(`/rounds/${id}`);
export const sendInterviewCommand = (command: InterviewCommand) =>
  request<InterviewCommandResult>("/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
