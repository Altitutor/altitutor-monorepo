import type {
  StudyPlanProfileInput,
  StudyPlanResponse,
} from "@/features/study-plan/model/types";

async function parseResponse(response: Response): Promise<StudyPlanResponse> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? "Study plan request failed.");
  }
  return response.json() as Promise<StudyPlanResponse>;
}

export function fetchStudyPlan(): Promise<StudyPlanResponse> {
  return fetch("/api/ucat/study-plan", { cache: "no-store" }).then(parseResponse);
}

export function saveStudyPlan(input: StudyPlanProfileInput): Promise<StudyPlanResponse> {
  return fetch("/api/ucat/study-plan", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then(parseResponse);
}

export async function updateStudyPlanTask(
  taskId: string,
  action: "start" | "skip" | "complete",
): Promise<void> {
  const response = await fetch(`/api/ucat/study-plan/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? "Failed to update Study plan task.");
  }
}
