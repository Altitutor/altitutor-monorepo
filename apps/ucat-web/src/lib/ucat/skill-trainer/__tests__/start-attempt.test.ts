import type { SkillTrainerAttemptState } from "@/features/skill-trainer/types/attempt";
import { startSkillTrainerAttempt } from "@/lib/ucat/skill-trainer/attempt-service";

const state: SkillTrainerAttemptState = {
  attempt: {
    id: "attempt-1",
    student_id: "student-1",
    skill_trainer_id: "trainer-1",
    score: 0,
    streak_count: 0,
    item_queue_snapshot: ["item-1", "item-2"],
    current_item_index: 0,
    current_item_started_at: "2026-07-20T00:00:00.000Z",
    progress: { type: "mental_maths" },
    config_snapshot: {
      time_limit_seconds: 60,
      points_correct: 10,
      points_wrong: 5,
      streak_enabled: true,
      streak_multiplier_steps: [],
      speed_bonus_enabled: false,
      speed_bonus_max_points: 0,
      speed_bonus_window_seconds: 8,
      trainer_key: "mental_maths",
    },
    ends_at: "2026-07-20T00:01:00.000Z",
    started_at: "2026-07-20T00:00:00.000Z",
    completed_at: null,
    discarded_at: null,
    trainer_key: "mental_maths",
    version: 0,
  },
  currentItem: { id: "item-1", content: { answer: 42 } },
  nextItem: { id: "item-2", content: { answer: 24 } },
  remainingSeconds: 60,
  isExpired: false,
  isCompleted: false,
};

function clientReturning(data: unknown) {
  const rpc = jest.fn().mockResolvedValue({ data, error: null });
  return {
    rpc,
    client: { rpc } as unknown as Parameters<
      typeof startSkillTrainerAttempt
    >[0],
  };
}

describe("startSkillTrainerAttempt", () => {
  it("starts through one atomic RPC", async () => {
    const { client, rpc } = clientReturning({ status: "started", state });

    await expect(
      startSkillTrainerAttempt(client, "user-1", "mental_maths"),
    ).resolves.toEqual({ started: true, state });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("start_ucat_skill_trainer_attempt", {
      p_user_id: "user-1",
      p_trainer_key: "mental_maths",
    });
  });

  it("returns a typed quota denial", async () => {
    const quota = {
      code: "QUOTA_EXCEEDED" as const,
      area: "skill_trainer" as const,
      used: 5,
      limit: 5,
      period: "week" as const,
    };
    const { client } = clientReturning({
      status: "quota_exceeded",
      quota,
    });

    await expect(
      startSkillTrainerAttempt(client, "user-1", "mental_maths"),
    ).resolves.toEqual({ started: false, quota });
  });

  it("maps expected database statuses to stable service errors", async () => {
    const { client } = clientReturning({ status: "no_items_available" });

    await expect(
      startSkillTrainerAttempt(client, "user-1", "mental_maths"),
    ).rejects.toThrow("NO_ITEMS_AVAILABLE");
  });

  it("rejects invalid trainer keys before calling the database", async () => {
    const { client, rpc } = clientReturning(null);

    await expect(
      startSkillTrainerAttempt(client, "user-1", "legacy_trainer"),
    ).rejects.toThrow("TRAINER_NOT_FOUND");
    expect(rpc).not.toHaveBeenCalled();
  });
});
