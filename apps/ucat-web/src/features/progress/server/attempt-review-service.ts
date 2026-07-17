import "server-only";

import type { Database } from "@altitutor/shared";
import type {
  AttemptReviewState,
  AttemptReviewType,
} from "@/features/progress/model/attempt-review";
import { supabaseAdmin } from "@/lib/supabase/admin";

function admin() {
  if (!supabaseAdmin)
    throw new Error("Attempt review service is not configured.");
  return supabaseAdmin;
}

async function studentIdFor(userId: string) {
  const { data, error } = await admin()
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data.id;
}

async function assertAttemptOwnership(
  studentId: string,
  attemptType: AttemptReviewType,
  attemptId: string,
) {
  const table =
    attemptType === "practice_session"
      ? "student_practice_sessions"
      : attemptType === "set_attempt"
        ? "student_question_set_attempts"
        : "student_ucat_mock_attempts";
  const { data, error } = await admin()
    .from(table)
    .select("id")
    .eq("id", attemptId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Attempt not found.");
}

function mapState(
  row: Database["public"]["Tables"]["student_ucat_attempt_reviews"]["Row"],
): AttemptReviewState {
  return {
    requiredQuestionIds: row.required_question_ids,
    viewedQuestionIds: row.viewed_question_ids,
    completedAt: row.completed_at,
    completionMethod:
      row.completion_method as AttemptReviewState["completionMethod"],
  };
}

export async function startAttemptReview(
  userId: string,
  attemptType: AttemptReviewType,
  attemptId: string,
  requiredQuestionIds: string[],
): Promise<AttemptReviewState> {
  const studentId = await studentIdFor(userId);
  await assertAttemptOwnership(studentId, attemptType, attemptId);
  const required = [...new Set(requiredQuestionIds)];
  const completedAt = required.length === 0 ? new Date().toISOString() : null;
  const { data, error } = await admin()
    .from("student_ucat_attempt_reviews")
    .upsert(
      {
        student_id: studentId,
        attempt_type: attemptType,
        attempt_id: attemptId,
        required_question_ids: required,
        ...(completedAt
          ? { completed_at: completedAt, completion_method: "automatic" }
          : {}),
      },
      { onConflict: "student_id,attempt_type,attempt_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return mapState(data);
}

export async function updateAttemptReview(
  userId: string,
  attemptType: AttemptReviewType,
  attemptId: string,
  input: { action: "view"; questionId: string } | { action: "complete" },
): Promise<AttemptReviewState> {
  const studentId = await studentIdFor(userId);
  await assertAttemptOwnership(studentId, attemptType, attemptId);
  const { data: current, error: readError } = await admin()
    .from("student_ucat_attempt_reviews")
    .select("*")
    .eq("student_id", studentId)
    .eq("attempt_type", attemptType)
    .eq("attempt_id", attemptId)
    .single();
  if (readError) throw readError;
  if (current.completed_at) return mapState(current);

  const now = new Date().toISOString();
  const viewed =
    input.action === "view"
      ? [...new Set([...current.viewed_question_ids, input.questionId])]
      : current.viewed_question_ids;
  const automatic = current.required_question_ids.every((id) =>
    viewed.includes(id),
  );
  const update: Database["public"]["Tables"]["student_ucat_attempt_reviews"]["Update"] =
    {
      viewed_question_ids: viewed,
      ...(input.action === "complete"
        ? { completed_at: now, completion_method: "manual" }
        : automatic
          ? { completed_at: now, completion_method: "automatic" }
          : {}),
    };
  const { data, error } = await admin()
    .from("student_ucat_attempt_reviews")
    .update(update)
    .eq("id", current.id)
    .select("*")
    .single();
  if (error) throw error;
  return mapState(data);
}
