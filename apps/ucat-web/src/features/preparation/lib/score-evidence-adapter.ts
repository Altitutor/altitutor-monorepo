import type { Database } from "@altitutor/shared";
import type { RepresentativeScoreEvidence } from "@/features/preparation/lib/score-model";

export const REPRESENTATIVE_SCORE_EVIDENCE_SELECT =
  "evidence_session_id, source, section_id, section_number, completed_at, score_points, total_points, question_count, section_question_count, was_timed, prescribed_pace, observed_pace, breadth, feedback_withheld, is_student_generated, is_standardised" as const;

type ScoreEvidenceRow = Omit<
  Database["public"]["Views"]["vstudent_ucat_score_projection_evidence"]["Row"],
  "scaled_score"
>;

export function parseRepresentativeScoreEvidence(
  row: ScoreEvidenceRow,
): RepresentativeScoreEvidence | null {
  if (
    !row.evidence_session_id ||
    (row.source !== "mock" &&
      row.source !== "set" &&
      row.source !== "practice") ||
    !row.section_id ||
    row.section_number == null ||
    !row.completed_at ||
    row.score_points == null ||
    row.total_points == null ||
    row.total_points <= 0 ||
    row.question_count == null ||
    row.section_question_count == null ||
    row.section_question_count <= 0 ||
    (row.breadth !== "broad" &&
      row.breadth !== "mixed" &&
      row.breadth !== "narrow")
  ) {
    return null;
  }
  return {
    evidenceSessionId: row.evidence_session_id,
    source: row.source,
    sectionId: row.section_id,
    sectionNumber: row.section_number,
    completedAt: row.completed_at,
    marksAwarded: row.score_points,
    marksAvailable: row.total_points,
    questionCount: row.question_count,
    sectionQuestionCount: row.section_question_count,
    wasTimed: row.was_timed ?? false,
    prescribedPace: row.prescribed_pace,
    breadth: row.breadth,
    feedbackWithheld: row.feedback_withheld ?? false,
    isStudentGenerated: row.is_student_generated ?? true,
    isStandardised: row.is_standardised ?? false,
  };
}
