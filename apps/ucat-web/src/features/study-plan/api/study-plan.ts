import type {
  StudyGuidanceAlternativeInput,
  StudyGuidanceItem,
  StudyPlanExtraStudyInput,
  StudyPlanProfileInput,
  StudyPlanResponse,
} from "@/features/study-plan/model/types";

async function parseJsonResponse<T>(
  response: Response,
  fallback: string,
): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error ?? fallback);
  }
  return response.json() as Promise<T>;
}

async function parseResponse(response: Response): Promise<StudyPlanResponse> {
  return parseJsonResponse(response, "Study plan request failed.");
}

export function fetchStudyPlan(): Promise<StudyPlanResponse> {
  return fetch("/api/ucat/study-plan", { cache: "no-store" }).then(
    parseResponse,
  );
}

export function fetchDashboardStudyPlan(): Promise<StudyPlanResponse> {
  return fetch("/api/ucat/study-plan?view=dashboard", {
    cache: "no-store",
  }).then(parseResponse);
}

export function saveStudyPlan(
  input: StudyPlanProfileInput,
): Promise<StudyPlanResponse> {
  return fetch("/api/ucat/study-plan", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then(parseResponse);
}

export function createExtraStudy(
  input: StudyPlanExtraStudyInput,
): Promise<StudyPlanResponse> {
  return fetch("/api/ucat/study-plan/extra", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then(parseResponse);
}

export function suggestAlternativeStudyGuidance(
  input: StudyGuidanceAlternativeInput,
): Promise<StudyGuidanceItem> {
  return fetch("/api/ucat/study-plan/alternative", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((response) =>
    parseJsonResponse(response, "Failed to suggest another activity."),
  );
}

export async function updateStudyPlanTask(
  taskId: string,
  action: "start" | "skip" | "unskip" | "complete",
): Promise<void> {
  const response = await fetch(`/api/ucat/study-plan/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error ?? "Failed to update Study plan task.");
  }
}
