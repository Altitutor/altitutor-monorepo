import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@altitutor/shared";
import {
  computeMaxRawScore,
  computeRawScore,
  estimateUcatSectionScore,
  resolveSingleUcatScoringSection,
  UCAT_SCORING_MODEL,
} from "@altitutor/ucat-marking";
import type { ScoringQuestion } from "@altitutor/ucat-marking";
import {
  compileResponseContract,
  createResponseState,
  type CandidateResponse,
} from "@altitutor/ucat-response-contract";
import { maybeGrantPracticeDayDiscount } from "@/lib/ucat/practice-day-discount";
import { persistQuestionAttemptBatch } from "@/lib/ucat/question-attempts/persist-question-attempt-batch";
import {
  parseAttemptContentSnapshot,
  snapshotToQuestionItem,
} from "@/features/progress/lib/attempt-content-snapshot";
import { responseDefinitionForQuestion } from "@/features/question-engine/lib/response-state";

type AdminClient = SupabaseClient;

type QuestionAttemptForScoring = {
  id: string;
  question_id: string;
  answer_snapshot: Json | null;
  content_snapshot?: Json | null;
  student_id: string;
};

export type FinalQuestionAttemptInput = {
  questionId: string;
  answerSnapshot?: Json | null;
  isFlagged?: boolean;
  wasTimed?: boolean;
  mode?: "question" | "question_stem" | "set" | "mock" | "learn";
};

/**
 * New attempts already carry an immutable server-generated question snapshot.
 * Reading marking metadata from it avoids three catalogue round trips and also
 * keeps the result stable if published content changes during an attempt.
 */
export function buildQuestionMetaFromAttemptSnapshots(
  attempts: QuestionAttemptForScoring[],
  expectedQuestionIds: Set<string>,
): ScoringQuestion[] | null {
  const attemptByQuestionId = new Map(
    attempts.map((attempt) => [attempt.question_id, attempt]),
  );
  const questions: ScoringQuestion[] = [];

  for (const questionId of expectedQuestionIds) {
    const snapshot = attemptByQuestionId.get(questionId)?.content_snapshot;
    if (
      !snapshot ||
      typeof snapshot !== "object" ||
      Array.isArray(snapshot) ||
      !Array.isArray((snapshot as Record<string, unknown>).answerOptions)
    ) {
      return null;
    }
    const parsed = parseAttemptContentSnapshot(snapshot);
    if (!parsed || parsed.question.id !== questionId) return null;
    const question = snapshotToQuestionItem(parsed, questions.length, "attempt");
    questions.push({
      definition: responseDefinitionForQuestion(question),
      sectionName: question.sectionName,
    });
  }

  return questions;
}

export async function persistFinalQuestionAttempts(
  admin: AdminClient,
  studentId: string,
  setAttemptId: string,
  answers: FinalQuestionAttemptInput[],
): Promise<void> {
  const finalAnswers = answers.filter((answer) => answer.questionId);
  if (finalAnswers.length === 0) {
    throw new Error("Set completion requires a final answer ledger");
  }
  await persistQuestionAttemptBatch(
    admin,
    studentId,
    {
      studentQuestionSetAttemptId: setAttemptId,
      studentPracticeSessionId: null,
      learningModuleBlockId: null,
    },
    finalAnswers.map((answer) => ({
      ...answer,
      submittedByStem: true,
    })),
  );
}

export function buildQuestionAttemptsForScoring(
  questionMeta: ScoringQuestion[],
  questionAttempts: QuestionAttemptForScoring[],
): Map<string, CandidateResponse> {
  const questionById = new Map(
    questionMeta.map((question) => [question.definition.questionId, question]),
  );
  const responses = new Map<string, CandidateResponse>();
  for (const attempt of questionAttempts) {
    const question = questionById.get(attempt.question_id);
    if (!question) continue;
    const compiled = compileResponseContract(question.definition);
    if (!compiled.ok) {
      throw new Error(compiled.issues.map((issue) => issue.message).join(" "));
    }
    const restored = createResponseState(compiled.contract, attempt.answer_snapshot);
    if (!restored.ok) {
      throw new Error(restored.issues.map((issue) => issue.message).join(" "));
    }
    responses.set(attempt.question_id, restored.state);
  }
  return responses;
}

export async function completeStudentSetAttempt(
  admin: AdminClient,
  studentId: string,
  attemptId: string,
  finalAnswers: FinalQuestionAttemptInput[],
  options: { grantDiscount?: boolean } = {},
): Promise<{
  earnedDiscount: boolean;
  discountCents: number;
  newlyCompleted: boolean;
}> {
  const { data: attempt, error: attemptError } = await admin
    .from("student_question_set_attempts")
    .select(
      "attempted_at, question_set_id, completed_at, discarded_at, expired_at",
    )
    .eq("id", attemptId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (attemptError) {
    throw new Error(attemptError.message);
  }
  if (!attempt) {
    throw new Error("Set attempt not found");
  }
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

  const attemptedAt = new Date(attempt.attempted_at);
  const now = new Date();
  const timeTakenSeconds = Math.max(
    0,
    Math.floor((now.getTime() - attemptedAt.getTime()) / 1000),
  );

  const questionSetId = attempt.question_set_id;
  if (!questionSetId) {
    throw new Error("Set attempt has no question set");
  }

  await persistFinalQuestionAttempts(admin, studentId, attemptId, finalAnswers);

  const { data: questionAttempts, error: questionAttemptsError } = await admin
    .from("student_question_attempts")
    .select(
      "id, question_id, answer_snapshot, content_snapshot, student_id",
    )
    .eq("student_question_set_attempt_id", attemptId)
    .eq("student_id", studentId);

  if (questionAttemptsError) {
    throw new Error(questionAttemptsError.message);
  }

  let totalQuestions = 0;
  let rawScore = 0;
  let scaledScore: number | null = null;
  let scoringModelVersion: string | null = null;

  const expectedQuestionIds = new Set(
    finalAnswers
      .map((answer) => answer.questionId)
      .filter((id): id is string => Boolean(id)),
  );
  const questionMeta = buildQuestionMetaFromAttemptSnapshots(
    (questionAttempts ?? []) as QuestionAttemptForScoring[],
    expectedQuestionIds,
  );
  if (!questionMeta) {
    throw new Error("Final question content snapshots are incomplete");
  }

  totalQuestions = questionMeta.length;

  if (questionMeta.length > 0) {
    const responses = buildQuestionAttemptsForScoring(
      questionMeta,
      (questionAttempts ?? []) as QuestionAttemptForScoring[],
    );

    const { questionScores, totalRawScore } = computeRawScore({
      responses,
      questions: questionMeta,
    });

    rawScore = totalRawScore;

    const maxRawScore = computeMaxRawScore(questionMeta);
    const scoringSection = resolveSingleUcatScoringSection(
      questionMeta.map((question) => question.sectionName),
    );
    if (maxRawScore > 0 && scoringSection) {
      scaledScore = estimateUcatSectionScore({
        section: scoringSection,
        rawScore,
        maxRawScore,
      }).scaledScore;
      scoringModelVersion = UCAT_SCORING_MODEL.version;
    }

    const updates = questionAttempts.map((qa) => ({
      id: qa.id,
      question_id: qa.question_id,
      student_id: qa.student_id,
      score: questionScores.get(qa.question_id) ?? 0,
      is_submitted: true,
    }));

    if (updates.length > 0) {
      const { error: updateQuestionsError } = await admin
        .from("student_question_attempts")
        .upsert(updates, { onConflict: "id" });

      if (updateQuestionsError) {
        throw new Error(updateQuestionsError.message);
      }
    }
  }

  const { data: updatedSet, error: updateSetError } = await admin
    .from("student_question_set_attempts")
    .update({
      time_taken_seconds: timeTakenSeconds,
      completed_at: now.toISOString(),
      score_points: totalQuestions === 0 ? null : rawScore,
      total_points:
        totalQuestions === 0 ? null : computeMaxRawScore(questionMeta),
      scaled_score: scaledScore,
      scoring_model_version: scoringModelVersion,
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

  if (updateSetError) {
    throw new Error(updateSetError.message);
  }
  if (!updatedSet) {
    const { data: terminal, error: terminalError } = await admin
      .from("student_question_set_attempts")
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

  if (options.grantDiscount === false) {
    return {
      earnedDiscount: false,
      discountCents: 0,
      newlyCompleted: true,
    };
  }

  const discount = await maybeGrantPracticeDayDiscount(admin, studentId);
  return {
    earnedDiscount: discount.earnedDiscount,
    discountCents: discount.discountCents,
    newlyCompleted: true,
  };
}
