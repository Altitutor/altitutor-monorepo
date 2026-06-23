import type { SupabaseClient } from "@supabase/supabase-js";
import { completeStudentSetAttempt } from "@/lib/ucat/set-attempts/complete-student-set-attempt";
import type { ExamAttemptKind } from "@/lib/ucat/exam-attempt/types";
import type { ExamEngineSnapshot } from "@/lib/ucat/exam-attempt/types";

type AdminClient = SupabaseClient;

export function isExamAttemptAtResults(
  kind: ExamAttemptKind,
  phase: ExamEngineSnapshot["phase"],
): boolean {
  switch (kind) {
    case "set":
      return phase === "marking";
    case "mock":
      return phase === "mockScore";
    case "practice":
      return phase === "practiceComplete";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

async function completeStudentMockAttempt(
  admin: AdminClient,
  studentId: string,
  attemptId: string,
): Promise<void> {
  const { data: attempt, error: attemptError } = await admin
    .from("student_ucat_mock_attempts")
    .select("attempted_at, completed_at")
    .eq("id", attemptId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (attemptError) throw new Error(attemptError.message);
  if (!attempt) throw new Error("Mock attempt not found");
  if (attempt.completed_at) return;

  const now = new Date();

  const { data: setAttempts, error: setAttemptsError } = await admin
    .from("student_question_set_attempts")
    .select(
      "id, question_set_id, score_points, total_points, scaled_score, time_taken_seconds, set_time_limit_seconds, set_time_limit_at_exam_speed_seconds, completed_at",
    )
    .eq("student_ucat_mock_attempt_id", attemptId)
    .eq("student_id", studentId);

  if (setAttemptsError) throw new Error(setAttemptsError.message);

  for (const setAttempt of setAttempts ?? []) {
    if (!setAttempt.completed_at && setAttempt.id) {
      await completeStudentSetAttempt(admin, studentId, setAttempt.id);
    }
  }

  const { data: completedSetAttempts } = await admin
    .from("student_question_set_attempts")
    .select(
      "question_set_id, score_points, total_points, scaled_score, time_taken_seconds, set_time_limit_seconds, set_time_limit_at_exam_speed_seconds",
    )
    .eq("student_ucat_mock_attempt_id", attemptId)
    .eq("student_id", studentId);

  const attempts = completedSetAttempts ?? [];
  const setIds = [
    ...new Set(
      attempts
        .map((a) => a.question_set_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: setDetails } =
    setIds.length > 0
      ? await admin.from("question_sets").select("id, sections").in("id", setIds)
      : { data: [] };

  const sectionNumberBySetId = new Map<string, number>();
  for (const s of setDetails ?? []) {
    const sections = s.sections as Array<{ section_number?: number }> | null;
    const firstNum =
      Array.isArray(sections) && sections.length > 0
        ? sections[0]?.section_number
        : undefined;
    if (firstNum != null) sectionNumberBySetId.set(s.id, firstNum);
  }

  const SITUATIONAL_JUDGEMENT_SECTION = 4;
  const scoredAttempts = attempts.filter((a) => {
    const sectionNum = a.question_set_id
      ? sectionNumberBySetId.get(a.question_set_id)
      : undefined;
    return sectionNum !== SITUATIONAL_JUDGEMENT_SECTION;
  });

  const scorePoints = scoredAttempts.reduce(
    (sum, a) => sum + (a.score_points ?? 0),
    0,
  );
  const totalPoints = scoredAttempts.reduce(
    (sum, a) => sum + (a.total_points ?? 0),
    0,
  );
  const scaledScore = scoredAttempts.reduce(
    (sum, a) => sum + (a.scaled_score ?? 0),
    0,
  );
  const timeTaken = attempts.reduce(
    (sum, a) => sum + (a.time_taken_seconds ?? 0),
    0,
  );
  const mockTimeLimitSeconds = attempts.reduce(
    (sum, a) => sum + (a.set_time_limit_seconds ?? 0),
    0,
  );
  const mockTimeLimitAtExamSpeedSeconds = attempts.reduce(
    (sum, a) => sum + (Number(a.set_time_limit_at_exam_speed_seconds) || 0),
    0,
  );
  const studentMockSpeed =
    timeTaken > 0 && mockTimeLimitSeconds > 0
      ? mockTimeLimitSeconds / timeTaken
      : null;

  const { error: updateError } = await admin
    .from("student_ucat_mock_attempts")
    .update({
      completed_at: now.toISOString(),
      score_points: totalPoints > 0 ? scorePoints : null,
      total_points: totalPoints > 0 ? totalPoints : null,
      scaled_score: totalPoints > 0 ? scaledScore : null,
      time_taken: timeTaken > 0 ? timeTaken : null,
      mock_time_limit_seconds:
        mockTimeLimitSeconds > 0 ? mockTimeLimitSeconds : null,
      mock_time_limit_at_exam_speed_seconds:
        mockTimeLimitAtExamSpeedSeconds > 0
          ? mockTimeLimitAtExamSpeedSeconds
          : null,
      student_mock_speed: studentMockSpeed,
      engine_snapshot: null,
      current_segment_ends_at: null,
    })
    .eq("id", attemptId)
    .eq("student_id", studentId);

  if (updateError) throw new Error(updateError.message);
}

async function completeStudentPracticeSession(
  admin: AdminClient,
  studentId: string,
  sessionId: string,
): Promise<void> {
  const { data: session, error: sessionError } = await admin
    .from("student_practice_sessions")
    .select(
      "id, completed_at, score_points, total_points, question_count, stems_snapshot",
    )
    .eq("id", sessionId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (sessionError) throw new Error(sessionError.message);
  if (!session) throw new Error("Practice session not found");
  if (session.completed_at) return;

  const { data: attempts } = await admin
    .from("student_question_attempts")
    .select("id, question_id, student_id, score")
    .eq("student_practice_session_id", sessionId)
    .eq("student_id", studentId);

  if (attempts && attempts.length > 0) {
    const updates = attempts.map((qa) => ({
      id: qa.id,
      question_id: qa.question_id,
      student_id: qa.student_id,
      score: Number(qa.score ?? 0),
      is_submitted: true,
    }));

    const { error: updateQuestionsError } = await admin
      .from("student_question_attempts")
      .upsert(updates, { onConflict: "id" });

    if (updateQuestionsError) throw new Error(updateQuestionsError.message);
  }

  const scorePoints =
    session.score_points ??
    (attempts ?? []).reduce((sum, row) => sum + Number(row.score ?? 0), 0);
  const questionCount =
    session.question_count ?? (attempts ?? []).length;

  const { error: updateSessionError } = await admin
    .from("student_practice_sessions")
    .update({
      completed_at: new Date().toISOString(),
      score_points: scorePoints,
      total_points: session.total_points ?? scorePoints,
      question_count: questionCount,
      stems_snapshot: session.stems_snapshot,
      engine_snapshot: null,
      current_segment_ends_at: null,
    })
    .eq("id", sessionId)
    .eq("student_id", studentId);

  if (updateSessionError) throw new Error(updateSessionError.message);
}

export async function finalizeExamAttemptOnServer(
  admin: AdminClient,
  studentId: string,
  kind: ExamAttemptKind,
  attemptId: string,
): Promise<void> {
  switch (kind) {
    case "set":
      await completeStudentSetAttempt(admin, studentId, attemptId);
      return;
    case "mock":
      await completeStudentMockAttempt(admin, studentId, attemptId);
      return;
    case "practice":
      await completeStudentPracticeSession(admin, studentId, attemptId);
      return;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
