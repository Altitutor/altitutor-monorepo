import "server-only";

import type { Database, Json } from "@altitutor/shared";
import { scaleTo300_900 } from "@altitutor/ucat-marking";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  defaultSettings,
  estimateSectionScore,
  type AttemptEvidence,
  type ScoreProjectionSettings,
} from "@/features/score-projection/lib/model";
import { addDays, midpointDate, todayIso } from "@/features/study-plan/lib/dates";
import { generateStudyPlan } from "@/features/study-plan/lib/generator";
import { estimateLearningModuleMinutes } from "@/features/study-plan/lib/module-duration";
import type {
  StudyPlanCapacityRisk,
  StudyPlanGenerationResult,
  StudyPlanLearningModule,
  StudyPlanProfileInput,
  StudyPlanResponse,
  StudyPlanSection,
  StudyPlanSectionSignal,
  StudyPlanTask,
} from "@/features/study-plan/model/types";

type StudyPlanReason =
  | "onboarding"
  | "weekly"
  | "profile_changed"
  | "mock_completed"
  | "significant_activity"
  | "manual";

type ProfileRow = Database["public"]["Tables"]["ucat_student_study_plan_profiles"]["Row"];
type GenerationRow = Database["public"]["Tables"]["ucat_student_study_plan_generations"]["Row"];
type TaskRow = Database["public"]["Tables"]["ucat_student_study_plan_tasks"]["Row"];

function requireAdmin() {
  if (!supabaseAdmin) throw new Error("Study plan service is not configured.");
  return supabaseAdmin;
}

function sectionKey(sectionNumber: number): StudyPlanSection["key"] {
  if (sectionNumber === 1) return "verbal_reasoning";
  if (sectionNumber === 2) return "decision_making";
  if (sectionNumber === 3) return "quantitative_reasoning";
  return "situational_judgement";
}

function shortSectionName(sectionNumber: number): string {
  return ["VR", "DM", "QR", "SJT"][sectionNumber - 1] ?? `Section ${sectionNumber}`;
}

function parseAvailability(value: Json): StudyPlanProfileInput["availableDays"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const weekday = item.weekday;
    const maxMinutes = item.maxMinutes;
    if (
      typeof weekday !== "number" ||
      typeof maxMinutes !== "number" ||
      weekday < 0 ||
      weekday > 6
    ) return [];
    return [{ weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6, maxMinutes }];
  });
}

async function resolveStudentId(userId: string): Promise<string> {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No student profile found.");
  return data.id;
}

async function planningDateFor(profile: ProfileRow): Promise<{
  planningDate: string;
  provisional: boolean;
}> {
  if (profile.test_date) return { planningDate: profile.test_date, provisional: false };
  const admin = requireAdmin();
  const { data } = await admin
    .from("ucat_study_plan_test_windows")
    .select("testing_starts_on, testing_ends_on")
    .eq("test_year", profile.test_year)
    .maybeSingle();
  if (data) {
    return {
      planningDate: midpointDate(data.testing_starts_on, data.testing_ends_on),
      provisional: true,
    };
  }
  return { planningDate: `${profile.test_year}-07-15`, provisional: true };
}

function projectionSettings(row: {
  mock_source_weight: number | null;
  set_source_weight: number | null;
  practice_source_weight: number | null;
  timed_weight: number | null;
  slow_timed_weight: number | null;
  untimed_weight: number | null;
  recency_half_life_days: number | null;
  min_practice_scored_points: number | null;
  min_prediction_evidence_weight: number | null;
} | undefined): ScoreProjectionSettings {
  const defaults = defaultSettings();
  if (!row) return defaults;
  return {
    ...defaults,
    mockSourceWeight: row.mock_source_weight ?? defaults.mockSourceWeight,
    setSourceWeight: row.set_source_weight ?? defaults.setSourceWeight,
    practiceSourceWeight: row.practice_source_weight ?? defaults.practiceSourceWeight,
    timedWeight: row.timed_weight ?? defaults.timedWeight,
    slowTimedWeight: row.slow_timed_weight ?? defaults.slowTimedWeight,
    untimedWeight: row.untimed_weight ?? defaults.untimedWeight,
    recencyHalfLifeDays: row.recency_half_life_days ?? defaults.recencyHalfLifeDays,
    minPracticeScoredPoints: row.min_practice_scored_points ?? defaults.minPracticeScoredPoints,
    minPredictionEvidenceWeight:
      row.min_prediction_evidence_weight ?? defaults.minPredictionEvidenceWeight,
  };
}

function predictedScoreFromEvidence(rows: Array<{
  source: string | null;
  completed_at: string | null;
  scaled_score: number | null;
  score_points: number | null;
  total_points: number | null;
  was_timed: boolean | null;
  student_exam_speed: number | null;
}>, settings: ScoreProjectionSettings): ReturnType<typeof estimateSectionScore> {
  const evidence: AttemptEvidence[] = rows.flatMap((row) => {
    if (row.source !== "practice" && row.source !== "set" && row.source !== "mock") return [];
    if (row.score_points == null || row.total_points == null || row.total_points <= 0) return [];
    if (row.source === "practice" && row.total_points < settings.minPracticeScoredPoints) return [];
    const score = row.source === "practice"
      ? scaleTo300_900(row.score_points, row.total_points)
      : row.scaled_score;
    const timestamp = row.completed_at ? new Date(row.completed_at).getTime() : Number.NaN;
    if (score == null || !Number.isFinite(timestamp)) return [];
    return [{
      source: row.source,
      score,
      scoredPoints: row.score_points,
      totalPoints: row.total_points,
      timestamp,
      wasTimed: row.was_timed ?? false,
      examSpeedRatio: row.student_exam_speed,
    }];
  });
  return estimateSectionScore(evidence, settings, Date.now());
}

async function loadGenerationInputs(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<{
  sections: StudyPlanSection[];
  signals: StudyPlanSectionSignal[];
  learningModules: StudyPlanLearningModule[];
  completedMockCount: number;
}> {
  const admin = requireAdmin();
  const [sectionsRes, evidenceRes, projectionSettingsRes, fullSetRes, modulesRes, blocksRes, moduleCategoriesRes, categoryProgressRes, mockRes] = await Promise.all([
    admin.from("ucat_sections").select("id, name, section_number, number_of_questions, time_per_question").order("section_number"),
    supabase.from("vstudent_ucat_score_projection_evidence").select("source, section_id, completed_at, scaled_score, score_points, total_points, was_timed, student_exam_speed"),
    admin.from("ucat_score_projection_settings").select("section_id, mock_source_weight, set_source_weight, practice_source_weight, timed_weight, slow_timed_weight, untimed_weight, recency_half_life_days, min_practice_scored_points, min_prediction_evidence_weight"),
    supabase.from("vstudent_ucat_section_set_progress").select("section_id, total_completed"),
    supabase.from("vstudent_ucat_learning_modules").select("id, title, kind, ucat_section_id, study_plan_priority, completion_percent").eq("kind", "lesson").neq("study_plan_priority", "excluded"),
    supabase.from("vstudent_ucat_learning_module_blocks").select("learning_module_id, block_type, content, question_id, question_stem_id, skill_trainer_id, file_id"),
    admin.from("ucat_learning_module_question_stem_categories").select("learning_module_id, question_stem_category_id"),
    supabase.from("vstudent_ucat_my_question_progress").select("category_id, correct_score, max_score"),
    admin.from("student_ucat_mock_attempts").select("id", { count: "exact", head: true }).eq("student_id", studentId).not("completed_at", "is", null),
  ]);
  for (const result of [sectionsRes, evidenceRes, projectionSettingsRes, fullSetRes, modulesRes, blocksRes, moduleCategoriesRes, categoryProgressRes, mockRes]) {
    if (result.error) throw result.error;
  }
  const sections: StudyPlanSection[] = (sectionsRes.data ?? []).flatMap((row) => {
    if (!row.id || !row.name || row.section_number == null) return [];
    return [{
      id: row.id,
      key: sectionKey(row.section_number),
      name: row.name,
      shortName: shortSectionName(row.section_number),
      sectionNumber: row.section_number,
      questionCount: row.number_of_questions ?? [44, 35, 36, 69][row.section_number - 1] ?? 30,
      timePerQuestionSeconds: Math.max(20, Math.round(row.time_per_question ?? 60)),
    }];
  });
  const evidenceBySection = new Map<string, typeof evidenceRes.data>();
  for (const row of evidenceRes.data ?? []) {
    if (!row.section_id) continue;
    evidenceBySection.set(row.section_id, [...(evidenceBySection.get(row.section_id) ?? []), row]);
  }
  const fullSets = new Map(
    (fullSetRes.data ?? []).flatMap((row) => row.section_id
      ? [[row.section_id, row.total_completed ?? 0] as const]
      : []),
  );
  const settingsBySection = new Map(
    (projectionSettingsRes.data ?? []).flatMap((row) => row.section_id ? [[row.section_id, row] as const] : []),
  );
  const signals = sections.map((section) => {
    const evidence = evidenceBySection.get(section.id) ?? [];
    const estimate = predictedScoreFromEvidence(
      evidence,
      projectionSettings(settingsBySection.get(section.id)),
    );
    return {
      sectionId: section.id,
      currentEstimate: section.sectionNumber <= 3 ? estimate.currentEstimate : null,
      evidenceCount: estimate.evidenceCount,
      completedFullSets: fullSets.get(section.id) ?? 0,
    };
  });
  const blocksByModule = new Map<string, Array<{
    blockType: string | null;
    content: unknown;
    questionId: string | null;
    questionStemId: string | null;
    skillTrainerId: string | null;
    fileId: string | null;
  }>>();
  for (const block of blocksRes.data ?? []) {
    if (!block.learning_module_id) continue;
    blocksByModule.set(block.learning_module_id, [
      ...(blocksByModule.get(block.learning_module_id) ?? []),
      {
        blockType: block.block_type,
        content: block.content,
        questionId: block.question_id,
        questionStemId: block.question_stem_id,
        skillTrainerId: block.skill_trainer_id,
        fileId: block.file_id,
      },
    ]);
  }
  const learningModules: StudyPlanLearningModule[] = (modulesRes.data ?? []).flatMap((module) => {
    if (!module.id || !module.title || module.study_plan_priority === "excluded") return [];
    const categoryIds = (moduleCategoriesRes.data ?? [])
      .filter((link) => link.learning_module_id === module.id)
      .map((link) => link.question_stem_category_id);
    const categoryScores = categoryIds.flatMap((categoryId) => {
      const progress = categoryProgressRes.data?.find((item) => item.category_id === categoryId);
      return progress && progress.max_score && progress.max_score > 0
        ? [1 - (progress.correct_score ?? 0) / progress.max_score]
        : [];
    });
    return [{
      id: module.id,
      title: module.title,
      sectionId: module.ucat_section_id,
      priority: module.study_plan_priority ?? "recommended",
      estimatedMinutes: estimateLearningModuleMinutes(blocksByModule.get(module.id) ?? []),
      completionPercent: module.completion_percent ?? 0,
      relevanceScore: categoryScores.length
        ? categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length
        : 0.3,
    }];
  });
  return { sections, signals, learningModules, completedMockCount: mockRes.count ?? 0 };
}

async function persistGeneration(
  studentId: string,
  profile: ProfileRow,
  planningDate: string,
  result: StudyPlanGenerationResult,
  reason: StudyPlanReason,
  completedMockCount: number,
  signals: StudyPlanSectionSignal[],
): Promise<void> {
  const admin = requireAdmin();
  const generatedAt = new Date().toISOString();
  const { error: supersedeError } = await admin
    .from("ucat_student_study_plan_generations")
    .update({ superseded_at: generatedAt })
    .eq("student_id", studentId)
    .is("superseded_at", null);
  if (supersedeError) throw supersedeError;
  const { data: generation, error: generationError } = await admin
    .from("ucat_student_study_plan_generations")
    .insert({
      student_id: studentId,
      profile_id: profile.id,
      reason,
      planning_date: planningDate,
      starts_on: todayIso(),
      ends_on: result.endsOn,
      input_snapshot: {
        targetScore: profile.target_score,
        testYear: profile.test_year,
        testDate: profile.test_date,
        availableDays: profile.available_days,
        preferredMockWeekday: profile.preferred_mock_weekday,
        completedMockCount,
      },
      projection_snapshot: {
        sectionTargets: result.sectionTargets,
        sectionSignals: signals,
      },
      capacity_risk: result.capacityRisk as unknown as Json,
    })
    .select("id")
    .single();
  if (generationError) throw generationError;
  if (result.tasks.length) {
    const { error: taskError } = await admin
      .from("ucat_student_study_plan_tasks")
      .insert(result.tasks.map((task) => ({
        generation_id: generation.id,
        student_id: studentId,
        scheduled_date: task.scheduledDate,
        sort_order: task.sortOrder,
        task_type: task.taskType,
        title: task.title,
        description: task.description,
        rationale: task.rationale,
        estimated_minutes: task.estimatedMinutes,
        target_units: task.targetUnits,
        section_id: task.sectionId,
        learning_module_id: task.learningModuleId,
        launch_path: task.launchPath,
        launch_config: task.launchConfig as Json,
      })));
    if (taskError) throw taskError;
  }
  const { error: profileError } = await admin
    .from("ucat_student_study_plan_profiles")
    .update({
      last_generated_at: generatedAt,
      next_weekly_replan_on: addDays(todayIso(), 7),
      setup_completed_at: profile.setup_completed_at ?? generatedAt,
    })
    .eq("id", profile.id);
  if (profileError) throw profileError;
}

async function generateForProfile(
  supabase: SupabaseClient<Database>,
  studentId: string,
  profile: ProfileRow,
  reason: StudyPlanReason,
): Promise<void> {
  const { planningDate } = await planningDateFor(profile);
  const inputs = await loadGenerationInputs(supabase, studentId);
  const result = generateStudyPlan({
    today: todayIso(),
    planningDate,
    profile: {
      targetScore: profile.target_score,
      testYear: profile.test_year,
      testDate: profile.test_date,
      availableDays: parseAvailability(profile.available_days),
      preferredMockWeekday: profile.preferred_mock_weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    },
    ...inputs,
  });
  await persistGeneration(
    studentId,
    profile,
    planningDate,
    result,
    reason,
    inputs.completedMockCount,
    inputs.signals,
  );
}

async function reconcileTasks(
  studentId: string,
  generation: GenerationRow,
  tasks: TaskRow[],
): Promise<void> {
  const admin = requireAdmin();
  const actionable = tasks.filter((task) =>
    task.scheduled_date <= todayIso() && !["completed", "skipped"].includes(task.status),
  );
  if (!actionable.length) return;
  const [learningRes, practiceRes, mockRes, trainerRes] = await Promise.all([
    admin.from("ucat_student_learning_module_progress").select("id, learning_module_id, completion_percent, completed_at").eq("student_id", studentId),
    admin.from("student_practice_sessions").select("id, ucat_section_id, question_count, started_at, completed_at").eq("student_id", studentId).gte("started_at", generation.generated_at).order("started_at"),
    admin.from("student_ucat_mock_attempts").select("id, attempted_at, completed_at").eq("student_id", studentId).gte("attempted_at", generation.generated_at).order("attempted_at"),
    admin.from("student_skill_trainer_attempts").select("id, skill_trainer_id, started_at, completed_at").eq("student_id", studentId).gte("started_at", generation.generated_at).order("started_at"),
  ]);
  for (const result of [learningRes, practiceRes, mockRes, trainerRes]) {
    if (result.error) throw result.error;
  }
  const usedActivities = new Set<string>(
    tasks.flatMap((task) => task.matched_activity_id ? [task.matched_activity_id] : []),
  );
  for (const task of actionable) {
    let update: Database["public"]["Tables"]["ucat_student_study_plan_tasks"]["Update"] | null = null;
    if (task.task_type === "learn" && task.learning_module_id) {
      const progress = learningRes.data?.find((item) => item.learning_module_id === task.learning_module_id);
      if (progress?.completed_at) {
        update = {
          status: "completed",
          completed_at: progress.completed_at,
          completed_units: 1,
          matched_activity_type: "learning_module",
          matched_activity_id: progress.id,
        };
      } else if (progress && progress.completion_percent > 0) {
        update = {
          status: "partial",
          completed_units: Math.round(progress.completion_percent),
          matched_activity_type: "learning_module",
          matched_activity_id: progress.id,
        };
      }
    } else if (["practice", "section_benchmark"].includes(task.task_type) && task.section_id) {
      const session = practiceRes.data?.find((item) =>
        !usedActivities.has(item.id) &&
        item.ucat_section_id === task.section_id &&
        item.completed_at &&
        (task.task_type !== "section_benchmark" || (item.question_count ?? 0) >= (task.target_units ?? 1) * 0.85),
      );
      if (session?.completed_at) {
        usedActivities.add(session.id);
        update = {
          status: "completed",
          completed_at: session.completed_at,
          completed_units: Math.min(task.target_units ?? session.question_count ?? 1, session.question_count ?? 1),
          matched_activity_type: "practice_session",
          matched_activity_id: session.id,
        };
      }
    } else if (task.task_type === "mock") {
      const attempt = mockRes.data?.find((item) => !usedActivities.has(item.id) && item.completed_at);
      if (attempt?.completed_at) {
        usedActivities.add(attempt.id);
        update = {
          status: "completed",
          completed_at: attempt.completed_at,
          completed_units: 1,
          matched_activity_type: "mock_attempt",
          matched_activity_id: attempt.id,
        };
      }
    } else if (task.task_type === "skill_trainer" && task.skill_trainer_id) {
      const attempt = trainerRes.data?.find((item) =>
        !usedActivities.has(item.id) && item.skill_trainer_id === task.skill_trainer_id && item.completed_at,
      );
      if (attempt?.completed_at) {
        usedActivities.add(attempt.id);
        update = {
          status: "completed",
          completed_at: attempt.completed_at,
          completed_units: 1,
          matched_activity_type: "skill_trainer_attempt",
          matched_activity_id: attempt.id,
        };
      }
    }
    if (update) {
      const { error } = await admin.from("ucat_student_study_plan_tasks").update(update).eq("id", task.id);
      if (error) throw error;
    }
  }
}

function mapTask(row: TaskRow): StudyPlanTask {
  return {
    id: row.id,
    scheduledDate: row.scheduled_date,
    sortOrder: row.sort_order,
    taskType: row.task_type as StudyPlanTask["taskType"],
    status: row.status as StudyPlanTask["status"],
    title: row.title,
    description: row.description ?? "",
    rationale: row.rationale ?? "",
    estimatedMinutes: row.estimated_minutes,
    targetUnits: row.target_units,
    completedUnits: row.completed_units,
    sectionId: row.section_id,
    learningModuleId: row.learning_module_id,
    launchPath: row.launch_path ?? "/dashboard",
    launchConfig: row.launch_config && typeof row.launch_config === "object" && !Array.isArray(row.launch_config)
      ? row.launch_config as Record<string, unknown>
      : {},
    startedAt: row.started_at,
    completedAt: row.completed_at,
    skippedAt: row.skipped_at,
    matchedActivityType: row.matched_activity_type,
    matchedActivityId: row.matched_activity_id,
  };
}

function readCapacityRisk(value: Json | null): StudyPlanCapacityRisk {
  const fallback: StudyPlanCapacityRisk = {
    level: "none",
    availableMinutesPerWeek: 0,
    recommendedMinutesPerWeek: 0,
    message: null,
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const record = value as Record<string, Json | undefined>;
  return {
    level: record.level === "warning" ? "warning" : "none",
    availableMinutesPerWeek: typeof record.availableMinutesPerWeek === "number" ? record.availableMinutesPerWeek : 0,
    recommendedMinutesPerWeek: typeof record.recommendedMinutesPerWeek === "number" ? record.recommendedMinutesPerWeek : 0,
    message: typeof record.message === "string" ? record.message : null,
  };
}

function readSectionTargets(value: Json): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const snapshot = value as Record<string, Json | undefined>;
  const targets = snapshot.sectionTargets;
  if (!targets || typeof targets !== "object" || Array.isArray(targets)) return {};
  return Object.fromEntries(
    Object.entries(targets).flatMap(([key, score]) => typeof score === "number" ? [[key, score]] : []),
  );
}

function readCompletedMockCount(value: Json): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const count = (value as Record<string, Json | undefined>).completedMockCount;
  return typeof count === "number" ? count : 0;
}

async function completedMockCount(studentId: string): Promise<number> {
  const admin = requireAdmin();
  const { count, error } = await admin
    .from("student_ucat_mock_attempts")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .not("completed_at", "is", null);
  if (error) throw error;
  return count ?? 0;
}

export async function saveStudyPlanProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: StudyPlanProfileInput,
): Promise<StudyPlanResponse> {
  const admin = requireAdmin();
  const studentId = await resolveStudentId(userId);
  const { data: profile, error } = await admin
    .from("ucat_student_study_plan_profiles")
    .upsert({
      student_id: studentId,
      target_score: input.targetScore,
      test_year: input.testYear,
      test_date: input.testDate,
      available_days: input.availableDays as unknown as Json,
      preferred_mock_weekday: input.preferredMockWeekday,
      setup_completed_at: new Date().toISOString(),
    }, { onConflict: "student_id" })
    .select("*")
    .single();
  if (error) throw error;
  await generateForProfile(supabase, studentId, profile, profile.last_generated_at ? "profile_changed" : "onboarding");
  return getStudyPlan(supabase, userId, { allowAutomaticReplan: false });
}

export async function getStudyPlan(
  supabase: SupabaseClient<Database>,
  userId: string,
  options: { allowAutomaticReplan?: boolean } = {},
): Promise<StudyPlanResponse> {
  const admin = requireAdmin();
  const studentId = await resolveStudentId(userId);
  const profileResult = await admin
    .from("ucat_student_study_plan_profiles")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();
  if (profileResult.error) throw profileResult.error;
  let profile = profileResult.data;
  if (!profile) {
    return {
      profile: null,
      generation: null,
      tasks: [],
      today: todayIso(),
      todayTasks: [],
      completion: { completed: 0, scheduledThroughToday: 0, percent: 0 },
    };
  }
  const generationResult = await admin
    .from("ucat_student_study_plan_generations")
    .select("*")
    .eq("student_id", studentId)
    .is("superseded_at", null)
    .maybeSingle();
  if (generationResult.error) throw generationResult.error;
  let generation = generationResult.data;
  const latestCompletedMocks = generation ? await completedMockCount(studentId) : 0;
  const mockCompletedSinceGeneration = generation
    ? latestCompletedMocks > readCompletedMockCount(generation.input_snapshot)
    : false;
  if (options.allowAutomaticReplan !== false && (
    !generation ||
    mockCompletedSinceGeneration ||
    !profile.next_weekly_replan_on ||
    profile.next_weekly_replan_on <= todayIso()
  )) {
    await generateForProfile(
      supabase,
      studentId,
      profile,
      !generation ? "onboarding" : mockCompletedSinceGeneration ? "mock_completed" : "weekly",
    );
    const [profileResult, generationResult] = await Promise.all([
      admin.from("ucat_student_study_plan_profiles").select("*").eq("id", profile.id).single(),
      admin.from("ucat_student_study_plan_generations").select("*").eq("student_id", studentId).is("superseded_at", null).single(),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (generationResult.error) throw generationResult.error;
    profile = profileResult.data;
    generation = generationResult.data;
  }
  let taskRows: TaskRow[] = [];
  if (generation) {
    const taskResult = await admin
      .from("ucat_student_study_plan_tasks")
      .select("*")
      .eq("generation_id", generation.id)
      .order("scheduled_date")
      .order("sort_order");
    if (taskResult.error) throw taskResult.error;
    taskRows = taskResult.data ?? [];
    await reconcileTasks(studentId, generation, taskRows);
    const refreshed = await admin
      .from("ucat_student_study_plan_tasks")
      .select("*")
      .eq("generation_id", generation.id)
      .order("scheduled_date")
      .order("sort_order");
    if (refreshed.error) throw refreshed.error;
    taskRows = refreshed.data ?? [];
  }
  const planning = await planningDateFor(profile);
  const tasks = taskRows.map(mapTask);
  const today = todayIso();
  const scheduledThroughToday = tasks.filter((task) => task.scheduledDate <= today && task.status !== "skipped").length;
  const completed = tasks.filter((task) => task.scheduledDate <= today && task.status === "completed").length;
  return {
    profile: {
      id: profile.id,
      targetScore: profile.target_score,
      testYear: profile.test_year,
      testDate: profile.test_date,
      availableDays: parseAvailability(profile.available_days),
      preferredMockWeekday: profile.preferred_mock_weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      planningDate: planning.planningDate,
      planningDateIsProvisional: planning.provisional,
      nextWeeklyReplanOn: profile.next_weekly_replan_on,
    },
    generation: generation ? {
      id: generation.id,
      generatedAt: generation.generated_at,
      reason: generation.reason,
      startsOn: generation.starts_on,
      endsOn: generation.ends_on,
      capacityRisk: readCapacityRisk(generation.capacity_risk),
      sectionTargets: readSectionTargets(generation.projection_snapshot),
    } : null,
    tasks,
    today,
    todayTasks: tasks.filter((task) => task.scheduledDate === today),
    completion: {
      completed,
      scheduledThroughToday,
      percent: scheduledThroughToday ? Math.round(completed / scheduledThroughToday * 100) : 0,
    },
  };
}

export async function updateStudyPlanTask(
  userId: string,
  taskId: string,
  action: "start" | "skip",
): Promise<void> {
  const admin = requireAdmin();
  const studentId = await resolveStudentId(userId);
  const now = new Date().toISOString();
  const { data: task, error: taskError } = await admin
    .from("ucat_student_study_plan_tasks")
    .select("id, status")
    .eq("id", taskId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (taskError) throw taskError;
  if (!task) throw new Error("Study plan task not found.");
  if (task.status === "completed") return;
  const { error } = await admin
    .from("ucat_student_study_plan_tasks")
    .update(action === "start"
      ? { status: "in_progress", started_at: now, skipped_at: null }
      : { status: "skipped", skipped_at: now })
    .eq("id", task.id);
  if (error) throw error;
}
