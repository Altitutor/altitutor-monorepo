import type { Json } from "@altitutor/shared";
import { computeRawScore, type ScoringQuestion } from "@altitutor/ucat-marking";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapQuestionStemsToItems,
  type QuestionItem,
  type QuestionStemWithQuestions,
} from "@/features/question-engine/model/types";
import type { FinalQuestionAttemptInput } from "@/lib/ucat/set-attempts/complete-student-set-attempt";
import { persistQuestionAttemptBatch } from "@/lib/ucat/question-attempts/persist-question-attempt-batch";
import {
  isBinaryPlacementResponse,
  responseDefinitionForQuestion,
  restorePersistedQuestionResponse,
  snapshotQuestionResponse,
} from "@/features/question-engine/lib/response-state";

type AdminClient = SupabaseClient;

export type PracticeSessionCompletionResult = {
  newlyCompleted: boolean;
  scorePoints: number;
  totalPoints: number;
  questionCount: number;
};

function parsePracticeQuestions(stemsSnapshot: Json | null): QuestionItem[] {
  if (!Array.isArray(stemsSnapshot)) {
    throw new Error("Practice session has no delivered question snapshot");
  }

  try {
    const questions = mapQuestionStemsToItems(
      stemsSnapshot as unknown as QuestionStemWithQuestions[],
    );
    const ids = new Set<string>();
    for (const question of questions) {
      if (!question.id || ids.has(question.id)) {
        throw new Error("Practice question snapshot is invalid");
      }
      ids.add(question.id);
    }
    return questions;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Practice question snapshot is invalid");
  }
}

function scoringQuestions(questions: QuestionItem[]): ScoringQuestion[] {
  return questions.map((question) => ({
    definition: responseDefinitionForQuestion(question),
    sectionName: question.sectionName,
  }));
}

export function scorePracticeAnswers(
  questions: QuestionItem[],
  answersByQuestionId: Map<string, FinalQuestionAttemptInput>,
): {
  questionScores: Map<string, number>;
  totalRawScore: number;
  maxRawScore: number;
} {
  const scoring = scoringQuestions(questions);
  const responses = new Map(questions.map((item) => {
    const answer = answersByQuestionId.get(item.id);
    const restored = restorePersistedQuestionResponse(
      item,
      answer?.answerSnapshot,
      answer?.questionAnswerOptionId,
    );
    return [
      item.id,
      snapshotQuestionResponse(
        item,
        restored.selectedOptionId ?? undefined,
        restored.syllogismSnapshot ?? undefined,
      ).response,
    ] as const;
  }));
  const scored = computeRawScore({
    responses,
    questions: scoring,
  });

  return {
    questionScores: scored.questionScores,
    totalRawScore: scored.totalRawScore,
    maxRawScore: scored.maximumRawScore,
  };
}

/**
 * Completes practice from the durable engine ledger and the immutable delivered
 * stem snapshot. Both normal submission and timed recovery use this path.
 */
export async function completeStudentPracticeSession(
  admin: AdminClient,
  studentId: string,
  sessionId: string,
  finalAnswers: FinalQuestionAttemptInput[],
): Promise<PracticeSessionCompletionResult> {
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
  if (session.completed_at) {
    return {
      newlyCompleted: false,
      scorePoints: Number(session.score_points ?? 0),
      totalPoints: Number(session.total_points ?? 0),
      questionCount: Number(session.question_count ?? 0),
    };
  }
  if (session.discarded_at || session.expired_at) {
    throw new Error("Attempt is no longer active");
  }

  const questions = parsePracticeQuestions(session.stems_snapshot);
  const questionById = new Map(
    questions.map((question) => [question.id, question]),
  );
  const suppliedByQuestionId = new Map<string, FinalQuestionAttemptInput>();
  for (const answer of finalAnswers) {
    const question = questionById.get(answer.questionId);
    if (!question) {
      throw new Error("Question is not part of this practice session");
    }
    const optionIds = new Set(question.options.map((option) => option.id));
    if (
      answer.questionAnswerOptionId != null &&
      !optionIds.has(answer.questionAnswerOptionId)
    ) {
      throw new Error("Answer option is not part of this practice question");
    }
    suppliedByQuestionId.set(answer.questionId, answer);
  }

  const answers = questions.map<FinalQuestionAttemptInput>((question) => {
    const supplied = suppliedByQuestionId.get(question.id);
    return {
      questionId: question.id,
      questionAnswerOptionId:
        isBinaryPlacementResponse(question)
          ? null
          : (supplied?.questionAnswerOptionId ?? null),
      answerSnapshot: supplied?.answerSnapshot ?? null,
      isFlagged: supplied?.isFlagged ?? false,
      wasTimed: supplied?.wasTimed ?? false,
      mode: supplied?.mode ?? "question_stem",
    };
  });
  const { questionScores, totalRawScore, maxRawScore } = scorePracticeAnswers(
    questions,
    new Map(answers.map((answer) => [answer.questionId, answer])),
  );

  await persistQuestionAttemptBatch(
    admin,
    studentId,
    {
      studentQuestionSetAttemptId: null,
      studentPracticeSessionId: sessionId,
      learningModuleBlockId: null,
    },
    answers.map((answer) => ({
      ...answer,
      score: questionScores.get(answer.questionId) ?? 0,
      submittedByStem: true,
    })),
  );

  const { data: updatedSession, error: updateSessionError } = await admin
    .from("student_practice_sessions")
    .update({
      completed_at: new Date().toISOString(),
      score_points: totalRawScore,
      total_points: maxRawScore,
      question_count: questions.length,
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
      .select("completed_at, score_points, total_points, question_count")
      .eq("id", sessionId)
      .eq("student_id", studentId)
      .maybeSingle();
    if (terminalError) throw new Error(terminalError.message);
    if (terminal?.completed_at) {
      return {
        newlyCompleted: false,
        scorePoints: Number(terminal.score_points ?? 0),
        totalPoints: Number(terminal.total_points ?? 0),
        questionCount: Number(terminal.question_count ?? 0),
      };
    }
    throw new Error("Attempt is no longer active");
  }

  return {
    newlyCompleted: true,
    scorePoints: totalRawScore,
    totalPoints: maxRawScore,
    questionCount: questions.length,
  };
}
