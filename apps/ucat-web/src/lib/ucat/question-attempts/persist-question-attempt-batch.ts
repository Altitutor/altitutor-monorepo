import type { Json } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient;

export type QuestionAttemptBatchInput = {
  questionId: string;
  answerSnapshot?: Json | null;
  isFlagged?: boolean;
  wasTimed?: boolean;
  mode?: "question" | "question_stem" | "set" | "mock" | "learn";
  submittedByStem?: boolean;
  score?: number;
  /** Client-observed total for completion fallback; merged with server timing by max. */
  timeSpentMilliseconds?: number;
};

export type QuestionAttemptBatchContext = {
  studentQuestionSetAttemptId: string | null;
  studentPracticeSessionId: string | null;
  learningModuleBlockId: string | null;
};

/**
 * Persists a group of attempts that share one set, practice session, learning
 * block, or standalone context.
 */
export async function persistQuestionAttemptBatch(
  admin: AdminClient,
  studentId: string,
  context: QuestionAttemptBatchContext,
  rawInputs: QuestionAttemptBatchInput[],
): Promise<void> {
  const inputByQuestionId = new Map<string, QuestionAttemptBatchInput>();
  for (const input of rawInputs) {
    if (input.questionId) inputByQuestionId.set(input.questionId, input);
  }
  const inputs = Array.from(inputByQuestionId.values());
  if (inputs.length === 0) return;

  // Set and practice attempts have database-enforced unique parent/question
  // keys. Persist them with one atomic UPSERT RPC instead of a SELECT followed
  // by separate update/insert requests. Besides reducing latency, this closes
  // the check-then-write race while retaining the maximum observed timing.
  if (context.studentQuestionSetAttemptId || context.studentPracticeSessionId) {
    const rpcClient = admin as unknown as {
      rpc: (
        functionName: "upsert_ucat_question_attempt_batch",
        params: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await rpcClient.rpc(
      "upsert_ucat_question_attempt_batch",
      {
        p_student_id: studentId,
        p_student_question_set_attempt_id: context.studentQuestionSetAttemptId,
        p_student_practice_session_id: context.studentPracticeSessionId,
        p_attempts: inputs.map((input) => ({
          question_id: input.questionId,
          answer_snapshot: input.answerSnapshot ?? null,
          has_answer_snapshot: Object.prototype.hasOwnProperty.call(
            input,
            "answerSnapshot",
          ),
          is_flagged: input.isFlagged ?? false,
          has_is_flagged: typeof input.isFlagged === "boolean",
          is_submitted: input.submittedByStem === true,
          was_timed: input.wasTimed ?? false,
          has_was_timed: typeof input.wasTimed === "boolean",
          mode: input.mode ?? null,
          score: input.score ?? 0,
          has_score: typeof input.score === "number",
          time_spent_milliseconds: input.timeSpentMilliseconds ?? null,
          has_time_spent_milliseconds: input.timeSpentMilliseconds != null,
        })),
      },
    );
    if (error) throw new Error(error.message);
    return;
  }

  const questionIds = inputs.map((input) => input.questionId);
  let existingQuery = admin
    .from("student_question_attempts")
    .select("id, question_id, time_spent_milliseconds")
    .eq("student_id", studentId)
    .in("question_id", questionIds);

  if (context.learningModuleBlockId) {
    existingQuery = existingQuery.eq(
      "learning_module_block_id",
      context.learningModuleBlockId,
    );
  } else {
    existingQuery = existingQuery
      .is("student_question_set_attempt_id", null)
      .is("student_practice_session_id", null)
      .is("learning_module_block_id", null);
  }

  const { data: existing, error: existingError } = await existingQuery;
  if (existingError) throw new Error(existingError.message);

  const existingByQuestionId = new Map<
    string,
    Array<{ id: string; timeSpentMilliseconds: number }>
  >();
  for (const row of existing ?? []) {
    const rows = existingByQuestionId.get(row.question_id) ?? [];
    rows.push({
      id: row.id,
      timeSpentMilliseconds: Math.max(0, row.time_spent_milliseconds ?? 0),
    });
    existingByQuestionId.set(row.question_id, rows);
  }

  const updates: Array<Record<string, unknown>> = [];
  const inserts: Array<Record<string, unknown>> = [];

  for (const input of inputs) {
    const hasAnswerSnapshot = Object.prototype.hasOwnProperty.call(
      input,
      "answerSnapshot",
    );
    const shared = {
      ...(hasAnswerSnapshot
        ? { answer_snapshot: input.answerSnapshot ?? null }
        : {}),
      ...(input.submittedByStem === true ? { is_submitted: true } : {}),
      ...(typeof input.isFlagged === "boolean"
        ? { is_flagged: input.isFlagged }
        : {}),
      ...(typeof input.wasTimed === "boolean"
        ? { was_timed: input.wasTimed }
        : {}),
      ...(input.mode ? { mode: input.mode } : {}),
      ...(typeof input.score === "number" ? { score: input.score } : {}),
    };
    const existingRows = existingByQuestionId.get(input.questionId) ?? [];

    if (existingRows.length > 0) {
      for (const row of existingRows) {
        const timeSpentMilliseconds = Math.max(
          row.timeSpentMilliseconds,
          Math.max(0, input.timeSpentMilliseconds ?? 0),
        );
        updates.push({
          id: row.id,
          question_id: input.questionId,
          student_id: studentId,
          ...shared,
          ...(input.timeSpentMilliseconds != null
            ? {
                time_spent_milliseconds: timeSpentMilliseconds,
                time_spent_seconds:
                  timeSpentMilliseconds > 0
                    ? Math.ceil(timeSpentMilliseconds / 1000)
                    : null,
              }
            : {}),
        });
      }
      continue;
    }

    inserts.push({
      student_id: studentId,
      student_question_set_attempt_id: null,
      student_practice_session_id: null,
      learning_module_block_id: context.learningModuleBlockId,
      question_id: input.questionId,
      answer_snapshot: input.answerSnapshot ?? null,
      is_flagged: input.isFlagged ?? false,
      is_submitted: input.submittedByStem === true,
      time_spent_seconds:
        input.timeSpentMilliseconds != null && input.timeSpentMilliseconds > 0
          ? Math.ceil(input.timeSpentMilliseconds / 1000)
          : null,
      time_spent_milliseconds:
        input.timeSpentMilliseconds != null
          ? Math.max(0, input.timeSpentMilliseconds)
          : null,
      was_timed: input.wasTimed ?? false,
      mode: input.mode ?? null,
      ...(typeof input.score === "number" ? { score: input.score } : {}),
    });
  }

  const [updateResult, insertResult] = await Promise.all([
    updates.length > 0
      ? admin
          .from("student_question_attempts")
          .upsert(updates, { onConflict: "id" })
      : Promise.resolve({ error: null }),
    inserts.length > 0
      ? admin.from("student_question_attempts").upsert(inserts, {
          onConflict: "id",
        })
      : Promise.resolve({ error: null }),
  ]);

  if (updateResult.error) throw new Error(updateResult.error.message);
  if (insertResult.error) throw new Error(insertResult.error.message);
}
