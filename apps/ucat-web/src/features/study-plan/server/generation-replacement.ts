import "server-only";
import type { Database, Json } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PreparationEngineResult } from "@/features/preparation";
import type {
  StudyPlanProfileInput,
  StudyPlanSectionSignal,
} from "@/features/study-plan/model/types";
import { normalizeSjtPreference } from "@/features/preparation/lib/sjt-allocation-policy";
import { addDays, todayIso } from "@/features/study-plan/lib/dates";
import { mergeCurrentPreparationHistory } from "@/features/preparation/lib/forecast-evidence";
import { prepareStudyPlanTasks } from "@/features/study-plan/lib/persistence";
import { profileInput, planningDateFor } from "./preparation-profile";
import { persistPreparationProgression } from "./preparation-progression";

type ProfileRow =
  Database["public"]["Tables"]["ucat_student_study_plan_profiles"]["Row"];
type StudyPlanReason =
  | "onboarding"
  | "weekly"
  | "profile_changed"
  | "mock_completed"
  | "significant_activity"
  | "manual";
type ReplacementRequest = {
  studentId: string;
  profile: ProfileRow;
  reason: StudyPlanReason;
  refreshRequestVersion?: number;
};
type PreparationContext<Inputs> = {
  studentId: string;
  profile: StudyPlanProfileInput;
  planningDate: string;
  today: string;
  now: string;
  seed: string;
  preserveThrough: string | null;
  preservedGeneralLessonIds: string[];
  inputs: Inputs;
};

/** Owns preservation and replacement policy; callers supply identity and intent.
 * Progression and rollover writes deliberately precede the transactional replacement.
 * A replacement failure does not roll those earlier writes back.
 */
export async function replaceStudyPlanGeneration<
  Inputs extends {
    signals: StudyPlanSectionSignal[];
    completedMockCount: number;
  },
>(
  request: ReplacementRequest,
  dependencies: {
    admin: SupabaseClient<Database>;
    now: () => Date;
    createId: () => string;
    loadInputs: (studentId: string, testYear: number) => Promise<Inputs>;
    prepare: (
      context: PreparationContext<Inputs>,
    ) => Promise<PreparationEngineResult>;
  },
): Promise<void> {
  const { studentId, profile, reason, refreshRequestVersion } = request;
  const { admin } = dependencies;
  const { planningDate } = await planningDateFor(admin, profile);
  const inputs = await dependencies.loadInputs(studentId, profile.test_year);
  const now = dependencies.now();
  const { data: student, error: studentError } = await admin
    .from("students")
    .select("timezone")
    .eq("id", studentId)
    .single();
  if (studentError) throw studentError;
  const today = todayIso(now, student.timezone || "Australia/Adelaide");
  const preserveThrough = reason === "onboarding" ? null : today;
  const { data: activeGeneration, error: activeGenerationError } =
    preserveThrough
      ? await admin
          .from("ucat_student_study_plan_generations")
          .select("id")
          .eq("student_id", studentId)
          .is("superseded_at", null)
          .maybeSingle()
      : { data: null, error: null };
  if (activeGenerationError) throw activeGenerationError;
  // Replacement retains today's tasks and earlier active work. Reserve those
  // general lessons without treating missed tasks or lessons as complete.
  const { data: preservedGeneralTasks, error: preservedGeneralTasksError } =
    preserveThrough && activeGeneration
      ? await admin
          .from("ucat_student_study_plan_tasks")
          .select("learning_module_id, scheduled_date, status")
          .eq("student_id", studentId)
          .eq("generation_id", activeGeneration.id)
          .eq("task_type", "learn")
          .is("section_id", null)
          .in("status", ["planned", "partial", "in_progress"])
          .lte("scheduled_date", preserveThrough)
      : { data: [], error: null };
  if (preservedGeneralTasksError) throw preservedGeneralTasksError;
  const preservedGeneralLessonIds = (preservedGeneralTasks ?? []).flatMap(
    (task) =>
      task.learning_module_id &&
      (task.scheduled_date === preserveThrough || task.status === "in_progress")
        ? [task.learning_module_id]
        : [],
  );
  const generatedPreparation = await dependencies.prepare({
    studentId,
    preserveThrough,
    preservedGeneralLessonIds,
    profile: { ...profileInput(profile), studyPlanEnabled: true },
    planningDate,
    inputs,
    today,
    now: now.toISOString(),
    seed: `study-plan:${studentId}:${reason}:${today}`,
  });
  const preparation: PreparationEngineResult = {
    ...generatedPreparation,
    trajectory: {
      ...generatedPreparation.trajectory,
      history: mergeCurrentPreparationHistory(
        generatedPreparation.trajectory.history,
        generatedPreparation.currentScore,
        today,
        generatedPreparation.versions.trajectoryModel,
      ),
    },
  };
  await persistPreparationProgression(
    admin,
    studentId,
    profile.test_year,
    preparation,
  );
  await persistGeneration(
    admin,
    dependencies.createId,
    studentId,
    profile,
    planningDate,
    preparation,
    reason,
    inputs.completedMockCount,
    inputs.signals,
    today,
    preserveThrough,
    refreshRequestVersion,
  );
}

async function persistGeneration(
  admin: SupabaseClient<Database>,
  createId: () => string,
  studentId: string,
  profile: ProfileRow,
  planningDate: string,
  preparation: PreparationEngineResult,
  reason: StudyPlanReason,
  completedMockCount: number,
  signals: StudyPlanSectionSignal[],
  today: string,
  preserveThrough: string | null,
  refreshRequestVersion?: number,
): Promise<void> {
  const result = preparation.plan;
  const generatedAt = preparation.generatedAt;
  if (preserveThrough) {
    const { data: activeGeneration, error: generationError } = await admin
      .from("ucat_student_study_plan_generations")
      .select("id")
      .eq("student_id", studentId)
      .is("superseded_at", null)
      .maybeSingle();
    if (generationError) throw generationError;
    if (activeGeneration) {
      const { error: missedWorkError } = await admin
        .from("ucat_student_study_plan_tasks")
        .update({
          status: "skipped",
          skipped_at: generatedAt,
          skipped_reason: "rollover",
        })
        .eq("generation_id", activeGeneration.id)
        .lt("scheduled_date", preserveThrough)
        .in("status", ["planned", "partial"]);
      if (missedWorkError) throw missedWorkError;
    }
  }
  const preparedTasks = prepareStudyPlanTasks(
    result.tasks,
    preserveThrough,
    createId,
  );
  const taskRows = preparedTasks.map((task) => ({
    id: task.id,
    scheduled_date: task.scheduledDate,
    sort_order: task.sortOrder,
    task_type: task.taskType,
    title: task.title,
    description: task.description,
    rationale: task.rationale,
    estimated_minutes: task.estimatedMinutes,
    target_units: task.targetUnits,
    section_id: task.sectionId,
    question_stem_category_id: task.questionStemCategoryId,
    question_tag_id: task.questionTagId,
    learning_module_id: task.learningModuleId,
    question_set_id: task.questionSetId,
    mock_id: task.mockId,
    skill_trainer_id: task.skillTrainerId,
    launch_path: task.launchPath,
    launch_config: task.launchConfig,
    source_task_id: task.sourceTaskId,
  }));
  const replacementParams = {
    p_student_id: studentId,
    p_profile_id: profile.id,
    p_reason: reason,
    p_planning_date: planningDate,
    p_starts_on: today,
    p_ends_on: result.endsOn,
    p_input_snapshot: {
      seed: preparation.seed,
      versions: preparation.versions,
      timingProfile: preparation.timingProfile,
      targetScore: profile.target_score,
      testYear: profile.test_year,
      testDate: profile.test_date,
      availableDays: profile.available_days,
      preferredMockWeekday: profile.preferred_mock_weekday,
      sjtPreference: normalizeSjtPreference(profile.sjt_preference),
      completedMockCount,
    },
    p_projection_snapshot: {
      versions: preparation.versions,
      sectionTargets: result.sectionTargets,
      sectionSignals: signals,
      readiness: result.readiness,
      currentScore: preparation.currentScore,
      trajectory: preparation.trajectory,
      explanationTrace: preparation.explanationTrace,
    },
    p_capacity_risk: result.capacityRisk as unknown as Json,
    p_tasks: taskRows as unknown as Json,
    p_next_weekly_replan_on: addDays(today, 7),
    p_setup_completed_at: profile.setup_completed_at ?? generatedAt,
    p_preserve_through: preserveThrough ?? undefined,
  };
  const { error } = refreshRequestVersion
    ? await admin.rpc("replace_ucat_study_plan_generation_for_refresh", {
        ...replacementParams,
        p_preserve_through: preserveThrough ?? today,
        p_refresh_request_version: refreshRequestVersion,
      })
    : await admin.rpc("replace_ucat_study_plan_generation", replacementParams);
  if (error) throw error;
}
