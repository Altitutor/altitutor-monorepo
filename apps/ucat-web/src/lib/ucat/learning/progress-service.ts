import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@altitutor/shared";

type AdminClient = SupabaseClient<Database>;

export type BlockProgressUpdate = {
  interactionState?: Json;
  completed?: boolean;
  manuallyCompleted?: boolean;
};

export type LessonProgressResult = {
  completionPercent: number;
  completedAt: string | null;
  newlyCompleted: boolean;
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
): Promise<LessonProgressResult> {
  const blockIds = await loadLessonBlockIds(supabase, lessonId);
  const [completed, previousResult] = await Promise.all([
    countCompletedBlocks(supabase, studentId, blockIds),
    supabase
      .from("ucat_student_learning_module_progress")
      .select("completed_at")
      .eq("student_id", studentId)
      .eq("learning_module_id", lessonId)
      .maybeSingle(),
  ]);
  if (previousResult.error) throw new Error(previousResult.error.message);
  const completionPercent =
    blockIds.length === 0 ? 0 : Math.round((completed / blockIds.length) * 100);
  const completedAt =
    completionPercent >= 100 ? new Date().toISOString() : null;

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
  return {
    completionPercent,
    completedAt,
    newlyCompleted:
      completedAt != null && previousResult.data?.completed_at == null,
  };
}

export async function ensureLessonStarted(
  supabase: AdminClient,
  studentId: string,
  lessonId: string,
): Promise<{ created: boolean }> {
  const rpcClient = supabase as unknown as {
    rpc: (
      name: "start_ucat_learning_module",
      params: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await rpcClient.rpc("start_ucat_learning_module", {
    p_student_id: studentId,
    p_learning_module_id: lessonId,
  });
  if (error) throw new Error(error.message);
  const result = data as
    | { status: "started"; created: boolean }
    | { status: "quota_exceeded"; quota: Record<string, unknown> }
    | { status: "not_found" }
    | null;
  if (result?.status === "quota_exceeded") {
    throw new Error(`QUOTA_EXCEEDED:${JSON.stringify(result.quota)}`);
  }
  if (result?.status !== "started") throw new Error("Lesson not found");
  return { created: result.created };
}

export async function upsertBlockProgress(
  supabase: AdminClient,
  studentId: string,
  blockId: string,
  update: BlockProgressUpdate,
): Promise<void> {
  const rpcClient = supabase as unknown as {
    rpc: (
      name: "upsert_ucat_learning_module_block_progress",
      params: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { error } = await rpcClient.rpc(
    "upsert_ucat_learning_module_block_progress",
    {
      p_student_id: studentId,
      p_learning_module_block_id: blockId,
      p_interaction_state: update.interactionState ?? null,
      p_completed: update.completed ?? false,
      p_manually_completed: update.manuallyCompleted ?? null,
    },
  );

  if (error) throw new Error(error.message);
}

export async function markAllLessonBlocksComplete(
  supabase: AdminClient,
  studentId: string,
  lessonId: string,
): Promise<LessonProgressResult> {
  const blockIds = await loadLessonBlockIds(supabase, lessonId);
  const now = new Date().toISOString();

  // An explicit lesson-level completion remains meaningful for an empty
  // lesson (especially draft/test content). Recalculation alone would turn it
  // back into 0% because there are no blocks to count.
  if (blockIds.length === 0) {
    const { data: previous, error: previousError } = await supabase
      .from("ucat_student_learning_module_progress")
      .select("completed_at")
      .eq("student_id", studentId)
      .eq("learning_module_id", lessonId)
      .maybeSingle();
    if (previousError) throw new Error(previousError.message);

    const { error } = await supabase
      .from("ucat_student_learning_module_progress")
      .upsert(
        {
          student_id: studentId,
          learning_module_id: lessonId,
          completion_percent: 100,
          completed_at: now,
        },
        { onConflict: "student_id,learning_module_id" },
      );
    if (error) throw new Error(error.message);
    return {
      completionPercent: 100,
      completedAt: now,
      newlyCompleted: previous?.completed_at == null,
    };
  }

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

  return recalculateLessonProgress(supabase, studentId, lessonId);
}

export async function resetLessonProgress(
  supabase: AdminClient,
  studentId: string,
  lessonId: string,
): Promise<void> {
  const blockIds = await loadLessonBlockIds(supabase, lessonId);

  if (blockIds.length > 0) {
    const { error } = await supabase
      .from("ucat_student_learning_module_block_progress")
      .delete()
      .eq("student_id", studentId)
      .in("learning_module_block_id", blockIds);

    if (error) throw new Error(error.message);
  }

  const { data: existing, error: existingError } = await supabase
    .from("ucat_student_learning_module_progress")
    .select("id")
    .eq("student_id", studentId)
    .eq("learning_module_id", lessonId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  if (existing) {
    const { error } = await supabase
      .from("ucat_student_learning_module_progress")
      .update({
        completion_percent: 0,
        completed_at: null,
      })
      .eq("id", existing.id);

    if (error) throw new Error(error.message);
  }
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

function attemptHasAnswer(row: { answer_snapshot: Json | null }): boolean {
  return row.answer_snapshot != null;
}

/** Marks the block complete when every question in a question / stem block has a learn attempt with an answer. */
export async function maybeAutoCompleteQuestionBlock(
  supabase: AdminClient,
  studentId: string,
  blockId: string,
): Promise<{
  blockCompleted: boolean;
  lessonId: string | null;
  lessonNewlyCompleted: boolean;
}> {
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
    return {
      blockCompleted: false,
      lessonId: block?.learning_module_id ?? null,
      lessonNewlyCompleted: false,
    };
  }

  const requiredIds = await getRequiredQuestionIdsForBlock(supabase, blockId);
  if (requiredIds.length === 0) {
    return {
      blockCompleted: false,
      lessonId: block.learning_module_id,
      lessonNewlyCompleted: false,
    };
  }

  const { data: attempts, error: attemptsError } = await supabase
    .from("student_question_attempts")
    .select("question_id, answer_snapshot")
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
  if (!allAnswered) {
    return {
      blockCompleted: false,
      lessonId: block.learning_module_id,
      lessonNewlyCompleted: false,
    };
  }

  const alreadyComplete = await isBlockCompleteForStudent(
    supabase,
    studentId,
    blockId,
  );
  if (alreadyComplete) {
    return {
      blockCompleted: false,
      lessonId: block.learning_module_id,
      lessonNewlyCompleted: false,
    };
  }

  await upsertBlockProgress(supabase, studentId, blockId, { completed: true });
  const lessonProgress = await recalculateLessonProgress(
    supabase,
    studentId,
    block.learning_module_id,
  );
  return {
    blockCompleted: true,
    lessonId: block.learning_module_id,
    lessonNewlyCompleted: lessonProgress.newlyCompleted,
  };
}
