import type {
  SkillTrainerAttemptProgress,
  SkillTrainerConfigSnapshot,
} from "@altitutor/shared";

export type SubmitActionPayload =
  | { type: "place_word"; keyword_id: string; character_index: number }
  | { type: "click_occurrence"; occurrence_index: number }
  | { type: "skip_concept" }
  | { type: "syllogism_answer"; answer: boolean }
  | { type: "numeric_answer"; answer: number }
  | { type: "numpad_sequence"; sequence: string[] };

export type SkillTrainerAttemptState = {
  attempt: {
    id: string;
    student_id: string;
    skill_trainer_id: string;
    score: number;
    streak_count: number;
    item_queue_snapshot: string[];
    current_item_index: number;
    current_item_started_at: string | null;
    progress: SkillTrainerAttemptProgress | null;
    config_snapshot: SkillTrainerConfigSnapshot;
    ends_at: string;
    started_at: string;
    completed_at: string | null;
    discarded_at: string | null;
    trainer_key?: string;
    version: number;
  };
  currentItem: {
    id: string;
    content: Record<string, unknown>;
  } | null;
  nextItem: {
    id: string;
    content: Record<string, unknown>;
  } | null;
  remainingSeconds: number;
  isExpired: boolean;
  isCompleted: boolean;
};
