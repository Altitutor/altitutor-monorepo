import type {
  SkillTrainerAttemptProgress,
  SkillTrainerConfigSnapshot,
} from "@altitutor/shared";

export type SubmitActionPayload =
  | { type: "place_word"; keyword_id: string; sentence_index: number }
  | { type: "click_occurrence"; occurrence_index: number }
  | { type: "submit_concept" }
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
    progress: SkillTrainerAttemptProgress | null;
    config_snapshot: SkillTrainerConfigSnapshot;
    ends_at: string;
    started_at: string;
    completed_at: string | null;
    trainer_key?: string;
  };
  currentItem: {
    id: string;
    content: Record<string, unknown>;
  } | null;
  remainingSeconds: number;
  isExpired: boolean;
  isCompleted: boolean;
};
