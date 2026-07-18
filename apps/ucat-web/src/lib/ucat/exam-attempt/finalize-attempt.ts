import type { SupabaseClient } from "@supabase/supabase-js";
import {
  completeStudentSetAttempt,
  type FinalQuestionAttemptInput,
} from "@/lib/ucat/set-attempts/complete-student-set-attempt";
import type { ExamAttemptKind } from "@/lib/ucat/exam-attempt/types";
import type { ExamEngineSnapshot } from "@/lib/ucat/exam-attempt/types";
import { maybeGrantPracticeDayDiscount } from "@/lib/ucat/practice-day-discount";

type AdminClient = SupabaseClient;

export type FinalExamQuestionAttemptInput = FinalQuestionAttemptInput & {
  questionSetId?: string | null;
};

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

async function ensureMockSetAttemptForFinalize(
  admin: AdminClient,
  studentId: string,
  mockAttemptId: string,
  questionSetId: string,
  wasTimed: boolean,
): Promise<string> {
  const { data: existing, error: existingError } = await admin
    .from("student_question_set_attempts")
    .select("id")
    .eq("student_id", studentId)
    .eq("student_ucat_mock_attempt_id", mockAttemptId)
    .eq("question_set_id", questionSetId)
    .order("attempted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing?.id) return existing.id;

  const { data: inserted, error: insertError } = await admin
    .from("student_question_set_attempts")
    .insert({
      student_id: studentId,
      question_set_id: questionSetId,
      student_ucat_mock_attempt_id: mockAttemptId,
      was_timed: wasTimed,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: raced, error: racedError } = await admin
        .from("student_question_set_attempts")
        .select("id")
        .eq("student_id", studentId)
        .eq("student_ucat_mock_attempt_id", mockAttemptId)
        .eq("question_set_id", questionSetId)
        .order("attempted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (racedError) throw new Error(racedError.message);
      if (raced?.id) return raced.id;
    }
    throw new Error(insertError.message);
  }
  if (!inserted?.id) throw new Error("Failed to create mock set attempt");
  return inserted.id;
}

async function completeStudentMockAttempt(
  admin: AdminClient,
  studentId: string,
  attemptId: string,
  finalAnswers?: FinalExamQuestionAttemptInput[],
  options: { grantDiscount?: boolean } = {},
): Promise<{
  earnedDiscount: boolean;
  discountCents: number;
  newlyCompleted: boolean;
}> {
  const { data: attempt, error: attemptError } = await admin
    .from("student_ucat_mock_attempts")
    .select(
      "attempted_at, completed_at, discarded_at, expired_at, ucat_mock_id",
    )
    .eq("id", attemptId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (attemptError) throw new Error(attemptError.message);
  if (!attempt) throw new Error("Mock attempt not found");
  if (attempt.completed_at) {
    return {
      earnedDiscount: false,
      discountCents: 0,
      newlyCompleted: false,
    };
  }
  if (attempt.discarded_at || attempt.expired_at) {
    throw new Error("Attempt is no longer active");
  }
  if (!attempt.ucat_mock_id) throw new Error("Mock attempt has no mock");

  const now = new Date();

  const { data: mockSets, error: mockSetsError } = await admin
    .from("question_sets_ucat_mocks")
    .select("question_set_id, index")
    .eq("ucat_mock_id", attempt.ucat_mock_id)
    .order("index");

  if (mockSetsError) throw new Error(mockSetsError.message);

  const configuredSetIds = (mockSets ?? [])
    .map((row) => row.question_set_id)
    .filter((id): id is string => Boolean(id));

  if (configuredSetIds.length === 0) {
    throw new Error("Mock has no configured question sets");
  }

  const answersByQuestionSetId = new Map<string, FinalQuestionAttemptInput[]>();
  for (const answer of finalAnswers ?? []) {
    if (!answer.questionSetId) continue;
    const list = answersByQuestionSetId.get(answer.questionSetId) ?? [];
    list.push({
      questionId: answer.questionId,
      questionAnswerOptionId: answer.questionAnswerOptionId,
      answerSnapshot: answer.answerSnapshot,
      isFlagged: answer.isFlagged,
      wasTimed: answer.wasTimed,
      mode: answer.mode,
    });
    answersByQuestionSetId.set(answer.questionSetId, list);
  }

  const setAttempts = await Promise.all(
    configuredSetIds.map(async (questionSetId) => {
      const setAnswers = answersByQuestionSetId.get(questionSetId) ?? [];
      const wasTimed = setAnswers.some((answer) => answer.wasTimed === true);
      const setAttemptId = await ensureMockSetAttemptForFinalize(
        admin,
        studentId,
        attemptId,
        questionSetId,
        wasTimed,
      );
      return { setAttemptId, setAnswers };
    }),
  );
  const selectedSetAttemptIds = setAttempts.map(
    ({ setAttemptId }) => setAttemptId,
  );

  // Each set is independent. Score them concurrently, but grant the daily
  // discount only once after the mock is durable to avoid duplicate Stripe
  // calls racing across its constituent sets.
  await Promise.all(
    setAttempts.map(({ setAttemptId, setAnswers }) =>
      completeStudentSetAttempt(admin, studentId, setAttemptId, setAnswers, {
        grantDiscount: false,
      }),
    ),
  );

  const { data: completedSetAttempts, error: completedSetAttemptsError } =
    await admin
      .from("student_question_set_attempts")
      .select(
        "question_set_id, score_points, total_points, scaled_score, time_taken_seconds, set_time_limit_seconds, set_time_limit_at_exam_speed_seconds",
      )
      .eq("student_id", studentId)
      .in("id", selectedSetAttemptIds);

  if (completedSetAttemptsError) {
    throw new Error(completedSetAttemptsError.message);
  }

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
      ? await admin
          .from("question_sets")
          .select("id, sections")
          .in("id", setIds)
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

  const { data: updatedMock, error: updateError } = await admin
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
    .eq("student_id", studentId)
    .is("completed_at", null)
    .is("discarded_at", null)
    .is("expired_at", null)
    .select("id")
    .maybeSingle();

  if (updateError) throw new Error(updateError.message);
  if (!updatedMock) {
    const { data: terminal, error: terminalError } = await admin
      .from("student_ucat_mock_attempts")
      .select("completed_at")
      .eq("id", attemptId)
      .eq("student_id", studentId)
      .maybeSingle();
    if (terminalError) throw new Error(terminalError.message);
    if (terminal?.completed_at) {
      return {
        earnedDiscount: false,
        discountCents: 0,
        newlyCompleted: false,
      };
    }
    throw new Error("Attempt is no longer active");
  }

  const discount =
    options.grantDiscount === false
      ? { earnedDiscount: false, discountCents: 0 }
      : await maybeGrantPracticeDayDiscount(admin, studentId);
  return { ...discount, newlyCompleted: true };
}

async function completeStudentPracticeSession(
  admin: AdminClient,
  studentId: string,
  sessionId: string,
): Promise<boolean> {
  const { data: session, error: sessionError } = await admin
    .from("student_practice_sessions")
    .select(
      "id, completed_at, discarded_at, expired_at, score_points, total_points, question_count, stems_snapshot",
    )
    .eq("id", sessionId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (sessionError) throw new Error(sessionError.message);
  if (!session) throw new Error("Practice session not found");
  if (session.completed_at) return false;
  if (session.discarded_at || session.expired_at) {
    throw new Error("Attempt is no longer active");
  }

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
  const questionCount = session.question_count ?? (attempts ?? []).length;

  const { data: updatedSession, error: updateSessionError } = await admin
    .from("student_practice_sessions")
    .update({
      completed_at: new Date().toISOString(),
      score_points: scorePoints,
      total_points: session.total_points ?? scorePoints,
      question_count: questionCount,
      stems_snapshot: session.stems_snapshot,
      prefetched_stem_snapshot: null,
      engine_snapshot: null,
      current_segment_ends_at: null,
    })
    .eq("id", sessionId)
    .eq("student_id", studentId)
    .is("completed_at", null)
    .is("discarded_at", null)
    .is("expired_at", null)
    .select("id")
    .maybeSingle();

  if (updateSessionError) throw new Error(updateSessionError.message);
  if (!updatedSession) {
    const { data: terminal, error: terminalError } = await admin
      .from("student_practice_sessions")
      .select("completed_at")
      .eq("id", sessionId)
      .eq("student_id", studentId)
      .maybeSingle();
    if (terminalError) throw new Error(terminalError.message);
    if (terminal?.completed_at) return false;
    throw new Error("Attempt is no longer active");
  }
  return true;
}

export async function finalizeExamAttemptOnServer(
  admin: AdminClient,
  studentId: string,
  kind: ExamAttemptKind,
  attemptId: string,
  finalAnswers?: FinalExamQuestionAttemptInput[],
  options: { grantDiscount?: boolean } = {},
): Promise<{
  success: true;
  earnedDiscount?: boolean;
  discountCents?: number;
  newlyCompleted: boolean;
}> {
  switch (kind) {
    case "set": {
      const result = await completeStudentSetAttempt(
        admin,
        studentId,
        attemptId,
        finalAnswers,
        options,
      );
      return { success: true, ...result };
    }
    case "mock": {
      const result = await completeStudentMockAttempt(
        admin,
        studentId,
        attemptId,
        finalAnswers,
        options,
      );
      return { success: true, ...result };
    }
    case "practice":
      return {
        success: true,
        newlyCompleted: await completeStudentPracticeSession(
          admin,
          studentId,
          attemptId,
        ),
      };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
