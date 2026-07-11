import type { ScoreProjectionResponse } from "@/features/score-projection/types/score-projection";

export async function getScoreProjection(): Promise<ScoreProjectionResponse> {
  const res = await fetch("/api/ucat/score-projection");
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Failed to load score projection");
  }
  return (await res.json()) as ScoreProjectionResponse;
}
