import type {
  SkillTrainerAttemptState,
  SubmitActionPayload,
} from "@/features/skill-trainer/types/attempt";

export type SkillTrainerCatalogRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  ucat_section_id: string;
  section_name: string;
  section_number: number;
  sort_order: number;
  time_limit_seconds: number;
  streak_enabled: boolean;
};

export type LeaderboardEntry = {
  student_id: string;
  display_name: string;
  best_score: number;
  achieved_at: string;
  rank: number;
};

export type SkillTrainerAttemptConflictError = Error & {
  code: "ANOTHER_ATTEMPT_IN_PROGRESS";
  attempt: SkillTrainerAttemptState;
  activeTrainerKey?: string;
};

export function isSkillTrainerAttemptConflictError(
  error: unknown,
): error is SkillTrainerAttemptConflictError {
  return (
    error instanceof Error &&
    (error as Partial<SkillTrainerAttemptConflictError>).code ===
      "ANOTHER_ATTEMPT_IN_PROGRESS" &&
    (error as Partial<SkillTrainerAttemptConflictError>).attempt != null
  );
}

export const skillTrainerApi = {
  async listTrainers(): Promise<SkillTrainerCatalogRow[]> {
    const res = await fetch("/api/ucat/skill-trainers");
    if (!res.ok) throw new Error("Failed to load skill trainers");
    const json = (await res.json()) as { trainers: SkillTrainerCatalogRow[] };
    return json.trainers;
  },

  async getActiveAttempt(): Promise<SkillTrainerAttemptState | null> {
    const res = await fetch("/api/ucat/skill-trainer-attempts");
    if (!res.ok) throw new Error("Failed to load active attempt");
    const json = (await res.json()) as { attempt: SkillTrainerAttemptState | null };
    return json.attempt;
  },

  async startAttempt(trainerKey: string): Promise<SkillTrainerAttemptState> {
    const res = await fetch("/api/ucat/skill-trainer-attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trainerKey }),
    });
    if (!res.ok) {
      const json = (await res.json()) as {
        error?: string;
        code?: string;
        activeTrainerKey?: string;
        attempt?: SkillTrainerAttemptState;
      };
      if (res.status === 409 && json.attempt) {
        const error = new Error(
          json.error ?? "ANOTHER_ATTEMPT_IN_PROGRESS",
        ) as SkillTrainerAttemptConflictError;
        error.code = "ANOTHER_ATTEMPT_IN_PROGRESS";
        error.attempt = json.attempt;
        error.activeTrainerKey = json.activeTrainerKey;
        throw error;
      }
      throw new Error(json.error ?? "Failed to start attempt");
    }
    const json = (await res.json()) as { attempt: SkillTrainerAttemptState };
    return json.attempt;
  },

  async completeAttempt(attemptId: string): Promise<SkillTrainerAttemptState> {
    const res = await fetch(`/api/ucat/skill-trainer-attempts/${attemptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complete: true }),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      throw new Error(json.error ?? "Failed to submit attempt");
    }
    const json = (await res.json()) as { attempt: SkillTrainerAttemptState };
    return json.attempt;
  },

  async startSetAttempt(input: {
    trainerKey: string;
    skillTrainerSetId: string;
    learningModuleBlockId: string;
  }): Promise<SkillTrainerAttemptState> {
    const res = await fetch("/api/ucat/skill-trainer-attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      throw new Error(json.error ?? "Failed to start set attempt");
    }
    const json = (await res.json()) as { attempt: SkillTrainerAttemptState };
    return json.attempt;
  },

  async getAttempt(attemptId: string): Promise<SkillTrainerAttemptState> {
    const res = await fetch(`/api/ucat/skill-trainer-attempts/${attemptId}`);
    if (!res.ok) throw new Error("Failed to load attempt");
    const json = (await res.json()) as { attempt: SkillTrainerAttemptState };
    return json.attempt;
  },

  async submitAction(
    attemptId: string,
    payload: SubmitActionPayload,
  ): Promise<SkillTrainerAttemptState> {
    const res = await fetch(`/api/ucat/skill-trainer-attempts/${attemptId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      throw new Error(json.error ?? "Action failed");
    }
    const json = (await res.json()) as { attempt: SkillTrainerAttemptState };
    return json.attempt;
  },

  async getLeaderboard(
    trainerKey: string,
    window: "week" | "all_time" | "my_scores",
  ): Promise<LeaderboardEntry[]> {
    const res = await fetch(
      `/api/ucat/skill-trainers/${encodeURIComponent(trainerKey)}/leaderboard?window=${window}`,
    );
    if (!res.ok) throw new Error("Failed to load leaderboard");
    const json = (await res.json()) as { entries: LeaderboardEntry[] };
    return json.entries;
  },
};
