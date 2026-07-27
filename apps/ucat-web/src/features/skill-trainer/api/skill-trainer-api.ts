import type {
  SkillTrainerAttemptState,
  SubmitActionPayload,
} from "@/features/skill-trainer/types/attempt";
import { isUcatSkillTrainerKey, trainerKeyToSlug } from "@altitutor/shared";

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

export type SkillTrainerAttemptReview = {
  attempt: {
    id: string;
    score: number;
    started_at: string;
    completed_at: string | null;
    trainer_key: string;
  };
  items: Array<{
    id: string;
    item_id: string;
    content: Record<string, unknown>;
    score_delta: number;
    completed_at: string;
    elapsed_seconds: number | null;
    correct: boolean;
    answer: unknown;
  }>;
};

export const skillTrainerApi = {
  async listTrainers(): Promise<SkillTrainerCatalogRow[]> {
    const res = await fetch("/api/ucat/skill-trainers");
    if (!res.ok) throw new Error("Failed to load skill trainers");
    const json = (await res.json()) as { trainers: SkillTrainerCatalogRow[] };
    return json.trainers;
  },

  async startAttempt(trainerKey: string): Promise<SkillTrainerAttemptState> {
    const res = await fetch("/api/ucat/skill-trainer-attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trainerKey }),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      throw new Error(json.error ?? "Failed to start attempt");
    }
    const json = (await res.json()) as { attempt: SkillTrainerAttemptState };
    return json.attempt;
  },

  async discardAttempt(
    attemptId: string,
    options: { keepalive?: boolean } = {},
  ): Promise<void> {
    const res = await fetch(`/api/ucat/skill-trainer-attempts/${attemptId}`, {
      method: "DELETE",
      keepalive: options.keepalive,
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error ?? "Failed to discard attempt");
    }
  },

  async prepareLearningModuleSkillTrainerSession(input: {
    learningModuleBlockId: string;
  }): Promise<{
    session: SkillTrainerAttemptState;
    items: Array<{ id: string; content: Record<string, unknown> }>;
    trainerName: string;
  }> {
    const res = await fetch(
      `/api/ucat/learning-modules/blocks/${input.learningModuleBlockId}/skill-trainer-session`,
    );
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error ?? "Failed to load skill trainer");
    }
    return (await res.json()) as {
      session: SkillTrainerAttemptState;
      items: Array<{ id: string; content: Record<string, unknown> }>;
      trainerName: string;
    };
  },

  async getAttempt(attemptId: string): Promise<SkillTrainerAttemptState> {
    const res = await fetch(`/api/ucat/skill-trainer-attempts/${attemptId}`);
    if (!res.ok) throw new Error("Failed to load attempt");
    const json = (await res.json()) as { attempt: SkillTrainerAttemptState };
    return json.attempt;
  },

  async getAttemptReview(
    attemptId: string,
  ): Promise<SkillTrainerAttemptReview> {
    const res = await fetch(
      `/api/ucat/skill-trainer-attempts/${attemptId}?include=review`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error ?? "Failed to load attempt results");
    }
    const json = (await res.json()) as { review: SkillTrainerAttemptReview };
    return json.review;
  },

  async submitAction(
    attemptId: string,
    payload: SubmitActionPayload,
    expectedVersion: number,
  ): Promise<SkillTrainerAttemptState> {
    const res = await fetch(
      `/api/ucat/skill-trainer-attempts/${attemptId}/actions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: crypto.randomUUID(),
          expectedVersion,
          action: payload,
        }),
      },
    );
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      const error = new Error(json.error ?? "Action failed") as Error & {
        stale?: boolean;
      };
      error.stale = res.status === 409;
      throw error;
    }
    const json = (await res.json()) as { attempt: SkillTrainerAttemptState };
    return json.attempt;
  },

  async getLeaderboard(
    trainerKey: string,
    window: "week" | "all_time" | "my_scores",
  ): Promise<LeaderboardEntry[]> {
    if (!isUcatSkillTrainerKey(trainerKey)) {
      throw new Error("Invalid skill trainer");
    }
    const res = await fetch(
      `/api/ucat/skill-trainers/${trainerKeyToSlug(trainerKey)}/leaderboard?window=${window}`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error("Failed to load leaderboard");
    const json = (await res.json()) as { entries: LeaderboardEntry[] };
    return json.entries;
  },
};
