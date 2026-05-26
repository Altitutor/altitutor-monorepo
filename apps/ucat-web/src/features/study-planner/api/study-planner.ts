import type {
  StudyPlannerProjectionResponse,
  StudyPlannerSettings,
} from "@/features/study-planner/types/study-planner";

export async function getStudyPlannerSettings(): Promise<StudyPlannerSettings> {
  const res = await fetch("/api/ucat/study-planner/settings");
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Failed to load study planner settings");
  }
  return (await res.json()) as StudyPlannerSettings;
}

export async function patchStudyPlannerSettings(input: {
  testDate?: string | null;
  targetScores?: {
    s1?: number | null;
    s2?: number | null;
    s3?: number | null;
  };
}): Promise<void> {
  const res = await fetch("/api/ucat/study-planner/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Failed to save study planner settings");
  }
}

export async function getStudyPlannerProjection(): Promise<StudyPlannerProjectionResponse> {
  const res = await fetch("/api/ucat/study-planner/projection");
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Failed to load study planner projection");
  }
  return (await res.json()) as StudyPlannerProjectionResponse;
}
