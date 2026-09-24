import type { SkillTrainerAttemptState } from "@/features/skill-trainer/types/attempt";
import { submitLocalSkillTrainerAction } from "@/features/skill-trainer/lib/local-session";

describe("submitLocalSkillTrainerAction", () => {
  it("resets a Find Word streak after a wrong placement", () => {
    const currentItem = {
      id: "find-word-item",
      content: {
        passage: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Alpha beta" }],
            },
          ],
        },
        keywords: [{ id: "alpha", text: "Alpha" }],
      },
    };
    const state: SkillTrainerAttemptState = {
      attempt: {
        id: "attempt",
        student_id: "student",
        skill_trainer_id: "trainer",
        score: 40,
        streak_count: 4,
        item_queue_snapshot: [currentItem.id],
        current_item_index: 0,
        current_item_started_at: "2026-07-21T00:00:00.000Z",
        progress: { type: "find_word", placed_keyword_ids: [] },
        config_snapshot: {
          time_limit_seconds: 60,
          points_correct: 10,
          points_wrong: 0,
          streak_enabled: true,
          streak_multiplier_steps: [],
          speed_bonus_enabled: false,
          speed_bonus_max_points: 0,
          speed_bonus_window_seconds: 0,
          trainer_key: "find_word",
        },
        ends_at: "2026-07-21T00:01:00.000Z",
        started_at: "2026-07-21T00:00:00.000Z",
        completed_at: null,
        discarded_at: null,
        version: 0,
      },
      currentItem,
      nextItem: null,
      remainingSeconds: 30,
      isExpired: false,
      isCompleted: false,
    };

    const next = submitLocalSkillTrainerAction(
      state,
      "find_word",
      { type: "place_word", keyword_id: "alpha", character_index: 7 },
      new Map([[currentItem.id, currentItem]]),
    );

    expect(next.attempt.streak_count).toBe(0);
    expect(next.attempt.progress).toEqual({
      type: "find_word",
      placed_keyword_ids: [],
    });
  });

  it("rejects placing 1969 onto the hyphenated word mid-1969", () => {
    const passage =
      'They reached #32 in the US in mid-1969.';
    const tokenStart = passage.indexOf("mid-1969");
    const currentItem = {
      id: "illusion-item",
      content: {
        passage: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: passage }],
            },
          ],
        },
        keywords: [{ id: "year", text: "1969" }],
      },
    };
    const state: SkillTrainerAttemptState = {
      attempt: {
        id: "attempt",
        student_id: "student",
        skill_trainer_id: "trainer",
        score: 10,
        streak_count: 2,
        item_queue_snapshot: [currentItem.id],
        current_item_index: 0,
        current_item_started_at: "2026-07-21T00:00:00.000Z",
        progress: { type: "find_word", placed_keyword_ids: [] },
        config_snapshot: {
          time_limit_seconds: 60,
          points_correct: 10,
          points_wrong: 0,
          streak_enabled: true,
          streak_multiplier_steps: [],
          speed_bonus_enabled: false,
          speed_bonus_max_points: 0,
          speed_bonus_window_seconds: 0,
          trainer_key: "find_word",
        },
        ends_at: "2026-07-21T00:01:00.000Z",
        started_at: "2026-07-21T00:00:00.000Z",
        completed_at: null,
        discarded_at: null,
        version: 0,
      },
      currentItem,
      nextItem: null,
      remainingSeconds: 30,
      isExpired: false,
      isCompleted: false,
    };

    const next = submitLocalSkillTrainerAction(
      state,
      "find_word",
      { type: "place_word", keyword_id: "year", character_index: tokenStart },
      new Map([[currentItem.id, currentItem]]),
    );

    expect(next.attempt.streak_count).toBe(0);
    expect(next.attempt.progress).toEqual({
      type: "find_word",
      placed_keyword_ids: [],
    });
  });

  it("accepts placing mid-1969 onto that whole hyphenated word", () => {
    const passage =
      'They reached #32 in the US in mid-1969.';
    const tokenStart = passage.indexOf("mid-1969");
    const currentItem = {
      id: "illusion-item",
      content: {
        passage: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: passage }],
            },
          ],
        },
        keywords: [
          { id: "year", text: "mid-1969" },
          { id: "place", text: "US" },
        ],
      },
    };
    const state: SkillTrainerAttemptState = {
      attempt: {
        id: "attempt",
        student_id: "student",
        skill_trainer_id: "trainer",
        score: 10,
        streak_count: 2,
        item_queue_snapshot: [currentItem.id],
        current_item_index: 0,
        current_item_started_at: "2026-07-21T00:00:00.000Z",
        progress: { type: "find_word", placed_keyword_ids: [] },
        config_snapshot: {
          time_limit_seconds: 60,
          points_correct: 10,
          points_wrong: 0,
          streak_enabled: true,
          streak_multiplier_steps: [],
          speed_bonus_enabled: false,
          speed_bonus_max_points: 0,
          speed_bonus_window_seconds: 0,
          trainer_key: "find_word",
        },
        ends_at: "2026-07-21T00:01:00.000Z",
        started_at: "2026-07-21T00:00:00.000Z",
        completed_at: null,
        discarded_at: null,
        version: 0,
      },
      currentItem,
      nextItem: null,
      remainingSeconds: 30,
      isExpired: false,
      isCompleted: false,
    };

    const next = submitLocalSkillTrainerAction(
      state,
      "find_word",
      { type: "place_word", keyword_id: "year", character_index: tokenStart },
      new Map([[currentItem.id, currentItem]]),
    );

    expect(next.attempt.streak_count).toBe(3);
    expect(next.attempt.progress).toEqual({
      type: "find_word",
      placed_keyword_ids: ["year"],
    });
  });
});
