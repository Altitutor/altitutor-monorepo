import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@altitutor/shared";
import {
  computeMaxRawScore,
  computeRawScore,
  scaleTo300_900,
} from "@altitutor/ucat-marking";
import type { QuestionMeta } from "@altitutor/ucat-marking";
import { maybeGrantPracticeDayDiscount } from "@/lib/ucat/practice-day-discount";

type AdminClient = SupabaseClient;

type QuestionRow = {
  id: string;
  question_stem_id: string;
  question_type: "multiple_choice" | "syllogism";
};

type OptionRow = {
  id: string;
  question_id: string;
  index: number;
  is_answer: boolean;
};

export type FinalQuestionAttemptInput = {
  questionId: string;
  questionAnswerOptionId: string | null;
  answerSnapshot?: Json | null;
  isFlagged?: boolean;
  wasTimed?: boolean;
  mode?: "question" | "question_stem" | "set" | "mock" | "learn";
};

function buildQuestionMeta(
  questions: QuestionRow[],
  sectionByNameStemId: Map<string, string>,
  optionsByQuestionId: Map<string, OptionRow[]>,
): QuestionMeta[] {
  return questions.map((q) => {
    const sectionName =
      sectionByNameStemId.get(q.question_stem_id) ?? "Unknown";
    const options = (optionsByQuestionId.get(q.id) ?? [])
      .sort((a, b) => a.index - b.index)
      .map((o) => ({ id: o.id, index: o.index }));
    const correctOption = (optionsByQuestionId.get(q.id) ?? []).find(
      (o) => o.is_answer,
    );
    return {
      id: q.id,
      stemId: q.question_stem_id,
      sectionName,
      questionType: q.question_type,
      correctOptionId: correctOption?.id ?? "",
      options,
    };
  });
}

export async function persistFinalQuestionAttempts(
  admin: AdminClient,
  studentId: string,
  setAttemptId: string,
  answers: FinalQuestionAttemptInput[] | undefined,
): Promise<void> {
  const finalAnswers = (answers ?? []).filter((answer) => answer.questionId);
  if (finalAnswers.length === 0) return;

  const questionIds = [
    ...new Set(finalAnswers.map((answer) => answer.questionId)),
  ];
  const { data: existing, error: existingError } = await admin
    .from("student_question_attempts")
    .select("id, question_id")
    .eq("student_id", studentId)
    .eq("student_question_set_attempt_id", setAttemptId)
    .in("question_id", questionIds);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingByQuestionId = new Map<string, Array<{ id: string }>>();
  for (const row of existing ?? []) {
    const list = existingByQuestionId.get(row.question_id) ?? [];
    list.push({ id: row.id });
    existingByQuestionId.set(row.question_id, list);
  }

  const updates: Array<{
    id: string;
    question_id: string;
    student_id: string;
    question_answer_option_id: string | null;
    answer_snapshot: Json | null;
    is_flagged?: boolean;
    is_submitted: boolean;
    was_timed?: boolean;
    mode?: "question" | "question_stem" | "set" | "mock" | "learn";
  }> = [];
  const inserts: Array<{
    student_id: string;
    student_question_set_attempt_id: string;
    student_practice_session_id: null;
    learning_module_block_id: null;
    question_id: string;
    question_answer_option_id: string | null;
    answer_snapshot: Json | null;
    is_flagged: boolean;
    is_submitted: boolean;
    time_spent_seconds: null;
    was_timed: boolean;
    mode: "question" | "question_stem" | "set" | "mock" | "learn" | null;
  }> = [];

  for (const answer of finalAnswers) {
    const rows = existingByQuestionId.get(answer.questionId) ?? [];
    const base = {
      question_answer_option_id: answer.questionAnswerOptionId,
      answer_snapshot: answer.answerSnapshot ?? null,
      is_submitted: true,
      ...(typeof answer.isFlagged === "boolean"
        ? { is_flagged: answer.isFlagged }
        : {}),
      ...(typeof answer.wasTimed === "boolean"
        ? { was_timed: answer.wasTimed }
        : {}),
      ...(answer.mode ? { mode: answer.mode } : {}),
    };

    if (rows.length > 0) {
      for (const row of rows) {
        updates.push({
          id: row.id,
          question_id: answer.questionId,
          student_id: studentId,
          ...base,
        });
      }
      continue;
    }

    inserts.push({
      student_id: studentId,
      student_question_set_attempt_id: setAttemptId,
      student_practice_session_id: null,
      learning_module_block_id: null,
      question_id: answer.questionId,
      question_answer_option_id: answer.questionAnswerOptionId,
      answer_snapshot: answer.answerSnapshot ?? null,
      is_flagged: answer.isFlagged ?? false,
      is_submitted: true,
      time_spent_seconds: null,
      was_timed: answer.wasTimed ?? false,
      mode: answer.mode ?? null,
    });
  }

  if (updates.length > 0) {
    const { error: updateError } = await admin
      .from("student_question_attempts")
      .upsert(updates, { onConflict: "id" });

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  if (inserts.length > 0) {
    const { error: insertError } = await admin
      .from("student_question_attempts")
      .insert(inserts);

    if (insertError) {
      throw new Error(insertError.message);
    }
  }
}

export async function completeStudentSetAttempt(
  admin: AdminClient,
  studentId: string,
  attemptId: string,
  finalAnswers?: FinalQuestionAttemptInput[],
): Promise<{ earnedDiscount: boolean; discountCents: number }> {
  const { data: attempt, error: attemptError } = await admin
    .from("student_question_set_attempts")
    .select("attempted_at, question_set_id, completed_at")
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
    return { earnedDiscount: false, discountCents: 0 };
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
      "id, question_id, question_answer_option_id, answer_snapshot, student_id",
    )
    .eq("student_question_set_attempt_id", attemptId)
    .eq("student_id", studentId);

  if (questionAttemptsError) {
    throw new Error(questionAttemptsError.message);
  }

  const { data: setStems, error: setStemsError } = await admin
    .from("question_stems_question_sets")
    .select("question_stem_id")
    .eq("question_set_id", questionSetId)
    .order("index");

  if (setStemsError) {
    throw new Error(setStemsError.message);
  }

  const stemIds = [
    ...new Set((setStems ?? []).map((s) => s.question_stem_id).filter(Boolean)),
  ];

  let totalQuestions = 0;
  let rawScore = 0;
  let scaledScore: number | null = null;

  if (stemIds.length > 0) {
    const { data: questions, error: questionsError } = await admin
      .from("ucat_questions")
      .select("id, question_stem_id, question_type")
      .in("question_stem_id", stemIds)
      .is("deleted_at", null);

    if (questionsError) {
      throw new Error(questionsError.message);
    }

    const allQuestionIds = (questions ?? []).map((q) => q.id);
    totalQuestions = allQuestionIds.length;

    const { data: stems, error: stemsError } = await admin
      .from("question_stems")
      .select("id, section_id")
      .in("id", stemIds);

    if (stemsError) {
      throw new Error(stemsError.message);
    }

    const sectionIds = [...new Set((stems ?? []).map((s) => s.section_id))];

    const { data: sections, error: sectionsError } = await admin
      .from("ucat_sections")
      .select("id, name")
      .in("id", sectionIds);

    if (sectionsError) {
      throw new Error(sectionsError.message);
    }

    const sectionById = new Map((sections ?? []).map((s) => [s.id, s.name]));
    const sectionByNameStemId = new Map(
      (stems ?? []).map((s) => [s.id, sectionById.get(s.section_id) ?? ""]),
    );

    const { data: options, error: optionsError } = await admin
      .from("question_answer_options")
      .select("id, question_id, index, is_answer")
      .in("question_id", allQuestionIds);

    if (optionsError) {
      throw new Error(optionsError.message);
    }

    const optionsByQuestionId = new Map<string, OptionRow[]>();
    for (const opt of options ?? []) {
      const list = optionsByQuestionId.get(opt.question_id) ?? [];
      list.push(opt);
      optionsByQuestionId.set(opt.question_id, list);
    }

    const questionMeta = buildQuestionMeta(
      questions ?? [],
      sectionByNameStemId,
      optionsByQuestionId,
    );

    const syllogismQuestionIds = new Set(
      (questions ?? [])
        .filter((q) => q.question_type === "syllogism")
        .map((q) => q.id),
    );

    const attempts = (questionAttempts ?? []).flatMap((qa) => {
      if (!syllogismQuestionIds.has(qa.question_id)) {
        if (!qa.question_answer_option_id) return [];
        return [
          {
            questionId: qa.question_id,
            selectedOptionId: qa.question_answer_option_id as string,
          },
        ];
      }

      const snapshot = qa.answer_snapshot as
        | {
            type?: string;
            answers?: { question_answer_option_id: string; answer: boolean }[];
          }
        | null
        | undefined;

      if (
        !snapshot ||
        snapshot.type !== "syllogism_v1" ||
        !Array.isArray(snapshot.answers)
      ) {
        if (!qa.question_answer_option_id) return [];
        return [
          {
            questionId: qa.question_id,
            selectedOptionId: qa.question_answer_option_id as string,
          },
        ];
      }

      const chosen = snapshot.answers.find((a) => a.answer === true);
      if (!chosen) {
        return [];
      }

      return [
        {
          questionId: qa.question_id,
          selectedOptionId: chosen.question_answer_option_id,
        },
      ];
    });

    const { questionScores, totalRawScore } = computeRawScore({
      attempts,
      questions: questionMeta,
    });

    rawScore = totalRawScore;

    const maxRawScore = computeMaxRawScore(questionMeta);
    if (maxRawScore > 0) {
      scaledScore = scaleTo300_900(rawScore, maxRawScore);
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

  const { error: updateSetError } = await admin
    .from("student_question_set_attempts")
    .update({
      time_taken_seconds: timeTakenSeconds,
      completed_at: now.toISOString(),
      score_points: totalQuestions === 0 ? null : rawScore,
      total_points: totalQuestions === 0 ? null : totalQuestions,
      scaled_score: scaledScore,
      engine_snapshot: null,
      current_segment_ends_at: null,
    })
    .eq("id", attemptId)
    .eq("student_id", studentId);

  if (updateSetError) {
    throw new Error(updateSetError.message);
  }

  const discount = await maybeGrantPracticeDayDiscount(admin, studentId);
  return {
    earnedDiscount: discount.earnedDiscount,
    discountCents: discount.discountCents,
  };
}
