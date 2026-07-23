import {
  isSkillTrainerActionWithinDeadline,
  SKILL_TRAINER_ACTION_DEADLINE_GRACE_MS,
} from "@/lib/ucat/skill-trainer/attempt-service";

describe("isSkillTrainerActionWithinDeadline", () => {
  const endsAt = "2026-07-21T10:00:00.000Z";

  it("keeps an action received during the deadline grace", () => {
    expect(
      isSkillTrainerActionWithinDeadline(
        endsAt,
        new Date(
          Date.parse(endsAt) + SKILL_TRAINER_ACTION_DEADLINE_GRACE_MS - 1,
        ),
      ),
    ).toBe(true);
  });

  it("rejects an action received after the deadline grace", () => {
    expect(
      isSkillTrainerActionWithinDeadline(
        endsAt,
        new Date(
          Date.parse(endsAt) + SKILL_TRAINER_ACTION_DEADLINE_GRACE_MS + 1,
        ),
      ),
    ).toBe(false);
  });
});
