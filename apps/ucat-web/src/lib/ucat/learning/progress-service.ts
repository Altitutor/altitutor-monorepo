import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@altitutor/shared";

type AdminClient = SupabaseClient<Database>;

export type BlockProgressUpdate = {
  interactionState?: Json;
  completed?: boolean;
  manuallyCompleted?: boolean;
};

async function loadLessonBlockIds(
  supabase: AdminClient,
  lessonId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("ucat_learning_module_blocks")
    .select("id")
    .eq("learning_module_id", lessonId)
    .is("deleted_at", null)
    .order("index", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id);
}

async function countCompletedBlocks(
  supabase: AdminClient,
  studentId: string,
  blockIds: string[],
): Promise<number> {
  if (blockIds.length === 0) return 0;

  const { count, error } = await supabase
    .from("ucat_student_learning_module_block_progress")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .in("learning_module_block_id", blockIds)
    .not("completed_at", "is", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function recalculateLessonProgress(
  supabase: AdminClient,
  studentId: string,
  lessonId: string,
): Promise<{ completionPercent: number; completedAt: string | null }> {
  const blockIds = await loadLessonBlockIds(supabase, lessonId);
  const completed = await countCompletedBlocks(supabase, studentId, blockIds);
  const completionPercent =
    blockIds.length === 0 ? 0 : Math.round((completed / blockIds.length) * 100);
  const completedAt = completionPercent >= 100 ? new Date().toISOString() : null;

  const { error } = await supabase
    .from("ucat_student_learning_module_progress")
    .upsert(
      {
        student_id: studentId,
        learning_module_id: lessonId,
        completion_percent: completionPercent,
        completed_at: completedAt,
      },
      { onConflict: "student_id,learning_module_id" },
    );

  if (error) throw new Error(error.message);
  return { completionPercent, completedAt };
}

export async function ensureLessonStarted(
  supabase: AdminClient,
  studentId: string,
  lessonId: string,
): Promise<{ created: boolean }> {
  const { data: existing, error: existingError } = await supabase
    .from("ucat_student_learning_module_progress")
    .select("id")
    .eq("student_id", studentId)
    .eq("learning_module_id", lessonId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) return { created: false };

  const { error } = await supabase
    .from("ucat_student_learning_module_progress")
    .insert({
      student_id: studentId,
      learning_module_id: lessonId,
      completion_percent: 0,
    });

  if (error) throw new Error(error.message);
  return { created: true };
}

export async function upsertBlockProgress(
  supabase: AdminClient,
  studentId: string,
  blockId: string,
  update: BlockProgressUpdate,
): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from("ucat_student_learning_module_block_progress")
    .select("id, interaction_state, manually_completed")
    .eq("student_id", studentId)
    .eq("learning_module_block_id", blockId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  const interactionState =
    update.interactionState ??
    (existing?.interaction_state as Json | undefined) ??
    {};
  const manuallyCompleted =
    update.manuallyCompleted ?? existing?.manually_completed ?? false;
  const completedAt =
    update.completed || update.manuallyCompleted
      ? new Date().toISOString()
      : null;

  if (existing) {
    const { error } = await supabase
      .from("ucat_student_learning_module_block_progress")
      .update({
        interaction_state: interactionState,
        manually_completed: manuallyCompleted,
        completed_at: completedAt ?? undefined,
      })
      .eq("id", existing.id);

    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from("ucat_student_learning_module_block_progress")
    .insert({
      student_id: studentId,
      learning_module_block_id: blockId,
      interaction_state: interactionState,
      manually_completed: manuallyCompleted,
      completed_at: completedAt,
    });

  if (error) throw new Error(error.message);
}

export async function markAllLessonBlocksComplete(
  supabase: AdminClient,
  studentId: string,
  lessonId: string,
): Promise<void> {
  const blockIds = await loadLessonBlockIds(supabase, lessonId);
  const now = new Date().toISOString();

  for (const blockId of blockIds) {
    const { data: existing } = await supabase
      .from("ucat_student_learning_module_block_progress")
      .select("id")
      .eq("student_id", studentId)
      .eq("learning_module_block_id", blockId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("ucat_student_learning_module_block_progress")
        .update({
          completed_at: now,
          manually_completed: true,
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("ucat_student_learning_module_block_progress")
        .insert({
          student_id: studentId,
          learning_module_block_id: blockId,
          completed_at: now,
          manually_completed: true,
        });
      if (error) throw new Error(error.message);
    }
  }

  await recalculateLessonProgress(supabase, studentId, lessonId);
}

export async function isBlockCompleteForStudent(
  supabase: AdminClient,
  studentId: string,
  blockId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("ucat_student_learning_module_block_progress")
    .select("completed_at")
    .eq("student_id", studentId)
    .eq("learning_module_block_id", blockId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.completed_at != null;
}

async function getRequiredQuestionIdsForBlock(
  supabase: AdminClient,
  blockId: string,
): Promise<string[]> {
  const { data: block, error: blockError } = await supabase
    .from("ucat_learning_module_blocks")
    .select("block_type, question_stem_id, question_id")
    .eq("id", blockId)
    .is("deleted_at", null)
    .maybeSingle();

  if (blockError) throw new Error(blockError.message);
  if (!block) return [];

  if (block.block_type === "question" && block.question_id) {
    return [block.question_id];
  }

  if (block.block_type === "question_stem" && block.question_stem_id) {
    const { data: questions, error: questionsError } = await supabase
      .from("ucat_questions")
      .select("id")
      .eq("question_stem_id", block.question_stem_id)
      .is("deleted_at", null);

    if (questionsError) throw new Error(questionsError.message);
    return (questions ?? []).map((row) => row.id);
  }

  return [];
}

function attemptHasAnswer(row: {
  question_answer_option_id: string | null;
  answer_snapshot: Json | null;
}): boolean {
  return row.question_answer_option_id != null || row.answer_snapshot != null;
}

/** Marks the block complete when every question in a question / stem block has a learn attempt with an answer. */
export async function maybeAutoCompleteQuestionBlock(
  supabase: AdminClient,
  studentId: string,
  blockId: string,
): Promise<boolean> {
  const { data: block, error: blockError } = await supabase
    .from("ucat_learning_module_blocks")
    .select("id, learning_module_id, block_type")
    .eq("id", blockId)
    .is("deleted_at", null)
    .maybeSingle();

  if (blockError) throw new Error(blockError.message);
  if (
    !block ||
    (block.block_type !== "question" && block.block_type !== "question_stem")
  ) {
    return false;
  }

  const requiredIds = await getRequiredQuestionIdsForBlock(supabase, blockId);
  if (requiredIds.length === 0) return false;

  const { data: attempts, error: attemptsError } = await supabase
    .from("student_question_attempts")
    .select("question_id, question_answer_option_id, answer_snapshot")
    .eq("student_id", studentId)
    .eq("learning_module_block_id", blockId)
    .in("question_id", requiredIds);

  if (attemptsError) throw new Error(attemptsError.message);

  const answeredIds = new Set(
    (attempts ?? [])
      .filter((row) => attemptHasAnswer(row))
      .map((row) => row.question_id),
  );

  const allAnswered = requiredIds.every((id) => answeredIds.has(id));
  if (!allAnswered) return false;

  const alreadyComplete = await isBlockCompleteForStudent(
    supabase,
    studentId,
    blockId,
  );
  if (alreadyComplete) return false;

  await upsertBlockProgress(supabase, studentId, blockId, { completed: true });
  await recalculateLessonProgress(
    supabase,
    studentId,
    block.learning_module_id,
  );
  return true;
}
