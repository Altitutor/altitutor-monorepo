import "server-only";

import { randomUUID } from "node:crypto";
import type { Database, Json } from "@altitutor/shared";
import { estimateUcatSectionScore } from "@altitutor/ucat-marking";
import type { UcatScoringSection } from "@altitutor/ucat-marking";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  extractTextFromRichJson,
  type JsonLike,
} from "@/features/question-engine/model/rich-text";
import {
  defaultSettings,
  estimateSectionScore,
  type AttemptEvidence,
  type ScoreProjectionSettings,
} from "@/features/score-projection/lib/model";
import {
  addDays,
  midpointDate,
  todayIso,
} from "@/features/study-plan/lib/dates";
import {
  estimateReviewMinutes,
  generateExtraStudyTasks,
  generateStudyPlan,
  reviewTask,
} from "@/features/study-plan/lib/generator";
import { estimateLearningModuleMinutes } from "@/features/study-plan/lib/module-duration";
import { prepareStudyPlanTasks } from "@/features/study-plan/lib/persistence";
import {
  buildAlternativeNextStep,
  buildNextStepDrafts,
  formatAttemptReviewLabel,
  resolveGuidanceTrigger,
  type BuildNextStepsInput,
  type IncompleteAttemptReview,
  type LatestGuidanceActivity,
} from "@/features/study-plan/lib/next-step-guidance";
import {
  matchLearningModuleProgress,
  matchPracticeSession,
  shouldReconcileStudyPlanTask,
} from "@/features/study-plan/lib/reconciliation";
import type {
  StudyPlanCapacityRisk,
  StudyPlanCategorySignal,
  StudyPlanExtraStudyInput,
  StudyPlanGenerationResult,
  StudyGuidanceAlternativeInput,
  StudyGuidanceItem,
  StudyPlanLearningModule,
  StudyPlanProfileInput,
  StudyPlanResponse,
  StudyPlanSection,
  StudyPlanSectionSignal,
  StudyPlanSkillTrainer,
  StudyPlanTask,
} from "@/features/study-plan/model/types";

type StudyPlanReason =
  | "onboarding"
  | "weekly"
  | "profile_changed"
  | "mock_completed"
  | "significant_activity"
  | "manual";

type ProfileRow =
  Database["public"]["Tables"]["ucat_student_study_plan_profiles"]["Row"];
type GenerationRow =
  Database["public"]["Tables"]["ucat_student_study_plan_generations"]["Row"];
type TaskRow =
  Database["public"]["Tables"]["ucat_student_study_plan_tasks"]["Row"];
type NextStepRow =
  Database["public"]["Tables"]["ucat_student_next_steps"]["Row"];

export class ExtraStudyUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtraStudyUnavailableError";
  }
}

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
  return (
    ["VR", "DM", "QR", "SJT"][sectionNumber - 1] ?? `Section ${sectionNumber}`
  );
}

function parseAvailability(
  value: Json,
): StudyPlanProfileInput["availableDays"] {
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
    )
      return [];
    return [{ weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6, maxMinutes }];
  });
}

async function resolveStudentId(userId: string): Promise<string> {
  return (await resolveStudent(userId)).id;
}

async function resolveStudent(
  userId: string,
): Promise<{ id: string; timezone: string }> {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("students")
    .select("id, timezone")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No student profile found.");
  return {
    id: data.id,
    timezone: data.timezone || "Australia/Adelaide",
  };
}

async function planningDateFor(profile: ProfileRow): Promise<{
  planningDate: string;
  provisional: boolean;
}> {
  if (profile.test_date)
    return { planningDate: profile.test_date, provisional: false };
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

function projectionSettings(
  row:
    | {
        mock_source_weight: number | null;
        set_source_weight: number | null;
        practice_source_weight: number | null;
        timed_weight: number | null;
        slow_timed_weight: number | null;
        untimed_weight: number | null;
        recency_half_life_days: number | null;
        min_practice_scored_points: number | null;
        min_prediction_evidence_weight: number | null;
      }
    | undefined,
): ScoreProjectionSettings {
  const defaults = defaultSettings();
  if (!row) return defaults;
  return {
    ...defaults,
    mockSourceWeight: row.mock_source_weight ?? defaults.mockSourceWeight,
    setSourceWeight: row.set_source_weight ?? defaults.setSourceWeight,
    practiceSourceWeight:
      row.practice_source_weight ?? defaults.practiceSourceWeight,
    timedWeight: row.timed_weight ?? defaults.timedWeight,
    slowTimedWeight: row.slow_timed_weight ?? defaults.slowTimedWeight,
    untimedWeight: row.untimed_weight ?? defaults.untimedWeight,
    recencyHalfLifeDays:
      row.recency_half_life_days ?? defaults.recencyHalfLifeDays,
    minPracticeScoredPoints:
      row.min_practice_scored_points ?? defaults.minPracticeScoredPoints,
    minPredictionEvidenceWeight:
      row.min_prediction_evidence_weight ??
      defaults.minPredictionEvidenceWeight,
  };
}

function predictedScoreFromEvidence(
  rows: Array<{
    source: string | null;
    completed_at: string | null;
    score_points: number | null;
    total_points: number | null;
    was_timed: boolean | null;
    student_exam_speed: number | null;
  }>,
  settings: ScoreProjectionSettings,
  section: UcatScoringSection,
): ReturnType<typeof estimateSectionScore> {
  const evidence: AttemptEvidence[] = rows.flatMap((row) => {
    if (
      row.source !== "practice" &&
      row.source !== "set" &&
      row.source !== "mock"
    )
      return [];
    if (
      row.score_points == null ||
      row.total_points == null ||
      row.total_points <= 0
    )
      return [];
    if (
      row.source === "practice" &&
      row.total_points < settings.minPracticeScoredPoints
    )
      return [];
    const score = estimateUcatSectionScore({
      section,
      rawScore: row.score_points,
      maxRawScore: row.total_points,
    }).scaledScore;
    const timestamp = row.completed_at
      ? new Date(row.completed_at).getTime()
      : Number.NaN;
    if (score == null || !Number.isFinite(timestamp)) return [];
    return [
      {
        source: row.source,
        score,
        scoredPoints: row.score_points,
        totalPoints: row.total_points,
        timestamp,
        wasTimed: row.was_timed ?? false,
        examSpeedRatio: row.student_exam_speed,
      },
    ];
  });
  return estimateSectionScore(evidence, settings, Date.now());
}

async function loadGenerationInputs(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<{
  sections: StudyPlanSection[];
  signals: StudyPlanSectionSignal[];
  categories: StudyPlanCategorySignal[];
  learningModules: StudyPlanLearningModule[];
  skillTrainers: StudyPlanSkillTrainer[];
  completedMockCount: number;
}> {
  const admin = requireAdmin();
  const [
    sectionsRes,
    evidenceRes,
    projectionSettingsRes,
    fullSetRes,
    completedBenchmarksRes,
    categoriesRes,
    categoryCountsRes,
    categoryProgressRes,
    modulesRes,
    blocksRes,
    moduleCategoriesRes,
    trainersRes,
    trainerCategoriesRes,
    trainerItemsRes,
    trainerConfigsRes,
    mockRes,
  ] = await Promise.all([
    admin
      .from("ucat_sections")
      .select(
        "id, name, section_number, number_of_questions, time_per_question",
      )
      .order("section_number"),
    supabase
      .from("vstudent_ucat_score_projection_evidence")
      .select(
        "source, section_id, completed_at, score_points, total_points, was_timed, student_exam_speed",
      ),
    admin
      .from("ucat_score_projection_settings")
      .select(
        "section_id, mock_source_weight, set_source_weight, practice_source_weight, timed_weight, slow_timed_weight, untimed_weight, recency_half_life_days, min_practice_scored_points, min_prediction_evidence_weight",
      ),
    supabase
      .from("vstudent_ucat_section_set_progress")
      .select("section_id, total_completed"),
    admin
      .from("ucat_student_study_plan_tasks")
      .select("section_id")
      .eq("student_id", studentId)
      .eq("task_type", "section_benchmark")
      .eq("status", "completed"),
    admin.from("question_stem_categories").select("id, name, ucat_section_id"),
    supabase
      .from("vstudent_ucat_public_question_counts")
      .select("section_id, question_stem_category_id, total_questions"),
    supabase
      .from("vstudent_ucat_my_question_progress")
      .select("category_id, correct_score, max_score"),
    supabase
      .from("vstudent_ucat_learning_modules")
      .select(
        "id, title, kind, ucat_section_id, study_plan_priority, completion_percent",
      )
      .eq("kind", "lesson")
      .neq("study_plan_priority", "excluded"),
    supabase
      .from("vstudent_ucat_learning_module_blocks")
      .select(
        "learning_module_id, block_type, content, question_id, question_stem_id, skill_trainer_id, file_id",
      ),
    admin
      .from("ucat_learning_module_question_stem_categories")
      .select("learning_module_id, question_stem_category_id"),
    admin
      .from("ucat_skill_trainers")
      .select("id, key, name, ucat_section_id")
      .eq("is_enabled", true),
    admin
      .from("ucat_skill_trainer_question_stem_categories")
      .select("skill_trainer_id, question_stem_category_id"),
    admin
      .from("ucat_skill_trainer_items")
      .select("skill_trainer_id")
      .eq("is_active", true)
      .eq("approval_status", "approved")
      .is("deleted_at", null),
    admin
      .from("ucat_skill_trainer_config")
      .select("skill_trainer_id, time_limit_seconds"),
    admin
      .from("student_ucat_mock_attempts")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .not("completed_at", "is", null),
  ]);
  for (const result of [
    sectionsRes,
    evidenceRes,
    projectionSettingsRes,
    fullSetRes,
    completedBenchmarksRes,
    categoriesRes,
    categoryCountsRes,
    categoryProgressRes,
    modulesRes,
    blocksRes,
    moduleCategoriesRes,
    trainersRes,
    trainerCategoriesRes,
    trainerItemsRes,
    trainerConfigsRes,
    mockRes,
  ]) {
    if (result.error) throw result.error;
  }
  const sections: StudyPlanSection[] = (sectionsRes.data ?? []).flatMap(
    (row) => {
      if (!row.id || !row.name || row.section_number == null) return [];
      return [
        {
          id: row.id,
          key: sectionKey(row.section_number),
          name: row.name,
          shortName: shortSectionName(row.section_number),
          sectionNumber: row.section_number,
          questionCount:
            row.number_of_questions ??
            [44, 35, 36, 69][row.section_number - 1] ??
            30,
          timePerQuestionSeconds: Math.max(
            20,
            Math.round(row.time_per_question ?? 60),
          ),
        },
      ];
    },
  );
  const evidenceBySection = new Map<string, typeof evidenceRes.data>();
  for (const row of evidenceRes.data ?? []) {
    if (!row.section_id) continue;
    evidenceBySection.set(row.section_id, [
      ...(evidenceBySection.get(row.section_id) ?? []),
      row,
    ]);
  }
  const fullSets = new Map(
    (fullSetRes.data ?? []).flatMap((row) =>
      row.section_id
        ? [[row.section_id, row.total_completed ?? 0] as const]
        : [],
    ),
  );
  for (const benchmark of completedBenchmarksRes.data ?? []) {
    if (!benchmark.section_id) continue;
    fullSets.set(
      benchmark.section_id,
      Math.max(1, fullSets.get(benchmark.section_id) ?? 0),
    );
  }
  const settingsBySection = new Map(
    (projectionSettingsRes.data ?? []).flatMap((row) =>
      row.section_id ? [[row.section_id, row] as const] : [],
    ),
  );
  const signals = sections.map((section) => {
    const evidence = evidenceBySection.get(section.id) ?? [];
    const estimate = predictedScoreFromEvidence(
      evidence,
      projectionSettings(settingsBySection.get(section.id)),
      section.key,
    );
    return {
      sectionId: section.id,
      currentEstimate:
        section.sectionNumber <= 3 ? estimate.currentEstimate : null,
      evidenceCount: estimate.evidenceCount,
      completedFullSets: fullSets.get(section.id) ?? 0,
    };
  });
  const categoryCounts = new Map(
    (categoryCountsRes.data ?? []).flatMap((row) =>
      row.question_stem_category_id
        ? [[row.question_stem_category_id, row.total_questions ?? 0] as const]
        : [],
    ),
  );
  const categoryProgress = new Map(
    (categoryProgressRes.data ?? []).flatMap((row) =>
      row.category_id
        ? [
            [
              row.category_id,
              {
                correctScore: row.correct_score ?? 0,
                maxScore: row.max_score ?? 0,
              },
            ] as const,
          ]
        : [],
    ),
  );
  const categories: StudyPlanCategorySignal[] = (
    categoriesRes.data ?? []
  ).flatMap((category) => {
    const availableQuestionCount = categoryCounts.get(category.id) ?? 0;
    if (!category.ucat_section_id || availableQuestionCount <= 0) return [];
    const progress = categoryProgress.get(category.id) ?? {
      correctScore: 0,
      maxScore: 0,
    };
    const observedWeakness =
      progress.maxScore > 0
        ? 1 - progress.correctScore / progress.maxScore
        : 0.55;
    const reliability = Math.min(1, progress.maxScore / 10);
    return [
      {
        id: category.id,
        sectionId: category.ucat_section_id,
        name: category.name,
        availableQuestionCount,
        correctScore: progress.correctScore,
        maxScore: progress.maxScore,
        weaknessScore:
          observedWeakness * reliability + 0.55 * (1 - reliability),
      },
    ];
  });
  const categorySignals = new Map(
    categories.map((category) => [category.id, category]),
  );
  const blocksByModule = new Map<
    string,
    Array<{
      blockType: string | null;
      content: unknown;
      questionId: string | null;
      questionStemId: string | null;
      skillTrainerId: string | null;
      fileId: string | null;
    }>
  >();
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
  const learningModules: StudyPlanLearningModule[] = (
    modulesRes.data ?? []
  ).flatMap((module) => {
    if (
      !module.id ||
      !module.title ||
      module.study_plan_priority === "excluded"
    )
      return [];
    const categoryIds = (moduleCategoriesRes.data ?? [])
      .filter((link) => link.learning_module_id === module.id)
      .map((link) => link.question_stem_category_id);
    const categoryScores = categoryIds.flatMap((categoryId) => {
      const signal = categorySignals.get(categoryId);
      return signal ? [signal.weaknessScore] : [];
    });
    return [
      {
        id: module.id,
        title: module.title,
        sectionId: module.ucat_section_id,
        priority: module.study_plan_priority ?? "recommended",
        estimatedMinutes: estimateLearningModuleMinutes(
          blocksByModule.get(module.id) ?? [],
        ),
        completionPercent: module.completion_percent ?? 0,
        relevanceScore: categoryScores.length
          ? categoryScores.reduce((sum, score) => sum + score, 0) /
            categoryScores.length
          : 0.3,
      },
    ];
  });
  const trainersWithItems = new Set(
    (trainerItemsRes.data ?? []).map((item) => item.skill_trainer_id),
  );
  const trainerMinutes = new Map(
    (trainerConfigsRes.data ?? []).map((config) => [
      config.skill_trainer_id,
      Math.max(1, Math.ceil(config.time_limit_seconds / 60)),
    ]),
  );
  const skillTrainers: StudyPlanSkillTrainer[] = (
    trainersRes.data ?? []
  ).flatMap((trainer) => {
    if (!trainersWithItems.has(trainer.id)) return [];
    return [
      {
        id: trainer.id,
        key: trainer.key,
        name: trainer.name,
        sectionId: trainer.ucat_section_id,
        categoryIds: (trainerCategoriesRes.data ?? [])
          .filter((link) => link.skill_trainer_id === trainer.id)
          .map((link) => link.question_stem_category_id),
        estimatedMinutes: trainerMinutes.get(trainer.id) ?? 3,
      },
    ];
  });
  return {
    sections,
    signals,
    categories,
    learningModules,
    skillTrainers,
    completedMockCount: mockRes.count ?? 0,
  };
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
  const preserveThrough = reason === "onboarding" ? null : todayIso();
  const preparedTasks = prepareStudyPlanTasks(
    result.tasks,
    preserveThrough,
    randomUUID,
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
  const { error } = await admin.rpc("replace_ucat_study_plan_generation", {
    p_student_id: studentId,
    p_profile_id: profile.id,
    p_reason: reason,
    p_planning_date: planningDate,
    p_starts_on: todayIso(),
    p_ends_on: result.endsOn,
    p_input_snapshot: {
      targetScore: profile.target_score,
      testYear: profile.test_year,
      testDate: profile.test_date,
      availableDays: profile.available_days,
      preferredMockWeekday: profile.preferred_mock_weekday,
      completedMockCount,
    },
    p_projection_snapshot: {
      sectionTargets: result.sectionTargets,
      sectionSignals: signals,
    },
    p_capacity_risk: result.capacityRisk as unknown as Json,
    p_tasks: taskRows as unknown as Json,
    p_next_weekly_replan_on: addDays(todayIso(), 7),
    p_setup_completed_at: profile.setup_completed_at ?? generatedAt,
    p_preserve_through: preserveThrough ?? undefined,
  });
  if (error) throw error;
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
      studyPlanEnabled: true,
      studySuggestionsEnabled: profile.study_suggestions_enabled,
      targetScore: profile.target_score,
      testYear: profile.test_year,
      testDate: profile.test_date,
      availableDays: parseAvailability(profile.available_days),
      preferredMockWeekday: profile.preferred_mock_weekday as
        | 0
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6,
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

async function linkCompanionReview(
  tasks: TaskRow[],
  sourceTask: TaskRow,
  activity: {
    id: string;
    type: "practice_session" | "mock_attempt";
    questionCount: number | null;
  },
): Promise<void> {
  const review = tasks.find(
    (task) =>
      task.task_type === "review" && task.source_task_id === sourceTask.id,
  );
  if (!review) return;
  const currentConfig =
    review.launch_config &&
    typeof review.launch_config === "object" &&
    !Array.isArray(review.launch_config)
      ? (review.launch_config as Record<string, Json | undefined>)
      : {};
  const launchPath =
    activity.type === "mock_attempt"
      ? `/progress/mock-attempts/${activity.id}`
      : `/progress/practice-sessions/${activity.id}`;
  if (
    review.matched_activity_type === activity.type &&
    review.matched_activity_id === activity.id &&
    review.launch_path === launchPath &&
    currentConfig.awaitingAttempt === false
  ) {
    return;
  }
  const { error } = await requireAdmin()
    .from("ucat_student_study_plan_tasks")
    .update({
      matched_activity_type: activity.type,
      matched_activity_id: activity.id,
      launch_path: launchPath,
      launch_config: {
        ...currentConfig,
        awaitingAttempt: false,
        sourceActivityType: activity.type,
        sourceActivityId: activity.id,
      },
      ...(activity.questionCount != null
        ? { estimated_minutes: estimateReviewMinutes(activity.questionCount) }
        : {}),
    })
    .eq("id", review.id);
  if (error) throw error;
}

async function reconcileTasks(
  studentId: string,
  generation: GenerationRow,
  tasks: TaskRow[],
): Promise<void> {
  const admin = requireAdmin();
  const today = todayIso();
  const actionable = tasks.filter((task) =>
    shouldReconcileStudyPlanTask(
      {
        scheduledDate: task.scheduled_date,
        status: task.status as StudyPlanTask["status"],
        taskType: task.task_type as StudyPlanTask["taskType"],
      },
      today,
    ),
  );
  for (const sourceTask of tasks) {
    if (
      sourceTask.matched_activity_id &&
      (sourceTask.matched_activity_type === "practice_session" ||
        sourceTask.matched_activity_type === "mock_attempt")
    ) {
      await linkCompanionReview(tasks, sourceTask, {
        id: sourceTask.matched_activity_id,
        type: sourceTask.matched_activity_type,
        questionCount:
          sourceTask.matched_activity_type === "practice_session"
            ? sourceTask.completed_units
            : null,
      });
    }
  }
  if (!actionable.length) return;
  const evidenceSince = actionable.reduce(
    (earliest, task) =>
      task.started_at && task.started_at < earliest
        ? task.started_at
        : earliest,
    generation.generated_at,
  );
  const [learningRes, practiceRes, mockRes, trainerRes] = await Promise.all([
    admin
      .from("ucat_student_learning_module_progress")
      .select("id, learning_module_id, completion_percent, completed_at")
      .eq("student_id", studentId),
    admin
      .from("student_practice_sessions")
      .select(
        "id, ucat_section_id, question_count, filters_snapshot, started_at, completed_at",
      )
      .eq("student_id", studentId)
      .gte("started_at", evidenceSince)
      .order("started_at"),
    admin
      .from("student_ucat_mock_attempts")
      .select("id, attempted_at, completed_at")
      .eq("student_id", studentId)
      .gte("attempted_at", evidenceSince)
      .order("attempted_at"),
    admin
      .from("student_skill_trainer_attempts")
      .select("id, skill_trainer_id, started_at, completed_at")
      .eq("student_id", studentId)
      .gte("started_at", evidenceSince)
      .order("started_at"),
  ]);
  for (const result of [learningRes, practiceRes, mockRes, trainerRes]) {
    if (result.error) throw result.error;
  }
  const usedActivities = new Set<string>(
    tasks.flatMap((task) =>
      task.matched_activity_id ? [task.matched_activity_id] : [],
    ),
  );
  const reconciledAt = new Date().toISOString();
  for (const task of actionable) {
    let update:
      | Database["public"]["Tables"]["ucat_student_study_plan_tasks"]["Update"]
      | null = null;
    let reviewActivity: {
      id: string;
      type: "practice_session" | "mock_attempt";
      questionCount: number | null;
    } | null = null;
    if (task.task_type === "learn" && task.learning_module_id) {
      const progress = learningRes.data?.find(
        (item) => item.learning_module_id === task.learning_module_id,
      );
      const match = progress
        ? matchLearningModuleProgress(
            {
              completedAt: progress.completed_at,
              completionPercent: progress.completion_percent,
            },
            reconciledAt,
          )
        : null;
      if (match?.status === "completed") {
        update = {
          status: "completed",
          completed_at: match.completedAt,
          completed_units: match.completedUnits,
          matched_activity_type: "learning_module",
          matched_activity_id: progress!.id,
        };
      } else if (match?.status === "partial") {
        update = {
          status: "partial",
          completed_units: match.completedUnits,
          matched_activity_type: "learning_module",
          matched_activity_id: progress!.id,
        };
      }
    } else if (
      ["practice", "section_benchmark"].includes(task.task_type) &&
      task.section_id
    ) {
      const candidate = (practiceRes.data ?? []).flatMap((session) => {
        if (
          usedActivities.has(session.id) &&
          task.matched_activity_id !== session.id
        )
          return [];
        const match = matchPracticeSession(
          {
            taskId: task.id,
            sectionId: task.section_id!,
            questionStemCategoryId:
              task.task_type === "section_benchmark"
                ? null
                : task.question_stem_category_id,
            targetUnits: task.target_units,
          },
          {
            sectionId: session.ucat_section_id,
            questionCount: session.question_count,
            completedAt: session.completed_at,
            filtersSnapshot: session.filters_snapshot,
          },
        );
        return match ? [{ session, match }] : [];
      })[0];
      if (candidate?.session.completed_at) {
        const { session, match } = candidate;
        usedActivities.add(session.id);
        update = {
          status: match.status,
          completed_at:
            match.status === "completed" ? session.completed_at : null,
          completed_units: match.completedUnits,
          matched_activity_type: "practice_session",
          matched_activity_id: session.id,
        };
        reviewActivity = {
          id: session.id,
          type: "practice_session",
          questionCount: session.question_count,
        };
      }
    } else if (task.task_type === "mock") {
      const attempt = mockRes.data?.find(
        (item) => !usedActivities.has(item.id) && item.completed_at,
      );
      if (attempt?.completed_at) {
        usedActivities.add(attempt.id);
        update = {
          status: "completed",
          completed_at: attempt.completed_at,
          completed_units: 1,
          matched_activity_type: "mock_attempt",
          matched_activity_id: attempt.id,
        };
        reviewActivity = {
          id: attempt.id,
          type: "mock_attempt",
          questionCount: null,
        };
      }
    } else if (task.task_type === "skill_trainer" && task.skill_trainer_id) {
      const attempt = trainerRes.data?.find(
        (item) =>
          !usedActivities.has(item.id) &&
          item.skill_trainer_id === task.skill_trainer_id &&
          item.completed_at,
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
      const { error } = await admin
        .from("ucat_student_study_plan_tasks")
        .update(update)
        .eq("id", task.id);
      if (error) throw error;
      if (reviewActivity)
        await linkCompanionReview(tasks, task, reviewActivity);
    }
  }
}

function mapTask(row: TaskRow): StudyPlanTask {
  return {
    id: row.id,
    sourceTaskId: row.source_task_id,
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
    questionStemCategoryId: row.question_stem_category_id,
    questionTagId: row.question_tag_id,
    learningModuleId: row.learning_module_id,
    questionSetId: row.question_set_id,
    mockId: row.mock_id,
    skillTrainerId: row.skill_trainer_id,
    launchPath: row.launch_path ?? "/dashboard",
    launchConfig:
      row.launch_config &&
      typeof row.launch_config === "object" &&
      !Array.isArray(row.launch_config)
        ? (row.launch_config as Record<string, unknown>)
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
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fallback;
  const record = value as Record<string, Json | undefined>;
  return {
    level: record.level === "warning" ? "warning" : "none",
    availableMinutesPerWeek:
      typeof record.availableMinutesPerWeek === "number"
        ? record.availableMinutesPerWeek
        : 0,
    recommendedMinutesPerWeek:
      typeof record.recommendedMinutesPerWeek === "number"
        ? record.recommendedMinutesPerWeek
        : 0,
    message: typeof record.message === "string" ? record.message : null,
  };
}

function readSectionTargets(value: Json): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const snapshot = value as Record<string, Json | undefined>;
  const targets = snapshot.sectionTargets;
  if (!targets || typeof targets !== "object" || Array.isArray(targets))
    return {};
  return Object.fromEntries(
    Object.entries(targets).flatMap(([key, score]) =>
      typeof score === "number" ? [[key, score]] : [],
    ),
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

function mapNextStep(row: NextStepRow): StudyGuidanceItem {
  return {
    id: row.id,
    position: row.position === 2 ? 2 : 1,
    triggerKey: row.trigger_key,
    generatedOn: row.generated_on,
    taskType: row.task_type as StudyGuidanceItem["taskType"],
    title: row.title,
    description: row.description,
    rationale: row.rationale,
    estimatedMinutes: row.estimated_minutes,
    sectionId: row.section_id,
    questionStemCategoryId: row.question_stem_category_id,
    learningModuleId: row.learning_module_id,
    questionSetId: row.question_set_id,
    mockId: row.mock_id,
    skillTrainerId: row.skill_trainer_id,
    sourceAttemptType:
      row.source_attempt_type as StudyGuidanceItem["sourceAttemptType"],
    sourceAttemptId: row.source_attempt_id,
    launchPath: row.launch_path,
    launchConfig:
      row.launch_config &&
      typeof row.launch_config === "object" &&
      !Array.isArray(row.launch_config)
        ? (row.launch_config as Record<string, unknown>)
        : {},
  };
}

async function latestGuidanceActivity(
  studentId: string,
): Promise<LatestGuidanceActivity | null> {
  const admin = requireAdmin();
  const [practice, set, mock, trainer, learning, review] = await Promise.all([
    admin
      .from("student_practice_sessions")
      .select("id, completed_at")
      .eq("student_id", studentId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("student_question_set_attempts")
      .select("id, completed_at")
      .eq("student_id", studentId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("student_ucat_mock_attempts")
      .select("id, completed_at")
      .eq("student_id", studentId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("student_skill_trainer_attempts")
      .select("id, completed_at")
      .eq("student_id", studentId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("ucat_student_learning_module_progress")
      .select("id, completed_at")
      .eq("student_id", studentId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("student_ucat_attempt_reviews")
      .select("id, completed_at")
      .eq("student_id", studentId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const results = [practice, set, mock, trainer, learning, review];
  for (const result of results) if (result.error) throw result.error;
  return (
    [
      ["practice", practice.data],
      ["set", set.data],
      ["mock", mock.data],
      ["skill_trainer", trainer.data],
      ["learning", learning.data],
      ["review", review.data],
    ]
      .flatMap(([kind, row]) => {
        if (!row || typeof row === "string" || !row.completed_at) return [];
        return [
          { kind: String(kind), id: row.id, completedAt: row.completed_at },
        ];
      })
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0] ?? null
  );
}

function reviewTypeForActivity(
  kind: LatestGuidanceActivity["kind"],
): IncompleteAttemptReview["attemptType"] | null {
  if (kind === "practice") return "practice_session";
  if (kind === "set") return "set_attempt";
  if (kind === "mock") return "mock_attempt";
  return null;
}

async function describeIncompleteReview(
  studentId: string,
  review: Pick<IncompleteAttemptReview, "attemptType" | "attemptId"> | null,
): Promise<IncompleteAttemptReview | null> {
  if (!review) return null;
  const admin = requireAdmin();
  if (review.attemptType === "practice_session") {
    const { data, error } = await admin
      .from("student_practice_sessions")
      .select("section_key, was_timed")
      .eq("id", review.attemptId)
      .eq("student_id", studentId)
      .maybeSingle();
    if (error) throw error;
    return {
      ...review,
      attemptLabel: formatAttemptReviewLabel({
        attemptType: review.attemptType,
        sectionKey: data?.section_key,
        wasTimed: data?.was_timed,
      }),
    };
  }
  if (review.attemptType === "set_attempt") {
    const { data: attempt, error: attemptError } = await admin
      .from("student_question_set_attempts")
      .select("question_set_id, was_timed")
      .eq("id", review.attemptId)
      .eq("student_id", studentId)
      .maybeSingle();
    if (attemptError) throw attemptError;
    const { data: set, error: setError } = attempt
      ? await admin
          .from("question_sets")
          .select("name")
          .eq("id", attempt.question_set_id)
          .maybeSingle()
      : { data: null, error: null };
    if (setError) throw setError;
    return {
      ...review,
      attemptLabel: formatAttemptReviewLabel({
        attemptType: review.attemptType,
        name: set?.name ? extractTextFromRichJson(set.name as JsonLike) : null,
        wasTimed: attempt?.was_timed,
      }),
    };
  }
  const { data: attempt, error: attemptError } = await admin
    .from("student_ucat_mock_attempts")
    .select("ucat_mock_id")
    .eq("id", review.attemptId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (attemptError) throw attemptError;
  const { data: mock, error: mockError } = attempt
    ? await admin
        .from("ucat_mocks")
        .select("name")
        .eq("id", attempt.ucat_mock_id)
        .maybeSingle()
    : { data: null, error: null };
  if (mockError) throw mockError;
  return {
    ...review,
    attemptLabel: formatAttemptReviewLabel({
      attemptType: review.attemptType,
      name: mock?.name,
    }),
  };
}

async function loadNextStepBuildInput(
  supabase: SupabaseClient<Database>,
  studentId: string,
  profile: ProfileRow,
  options: Pick<
    BuildNextStepsInput,
    "today" | "dailyWarmup" | "incompleteReview"
  >,
): Promise<BuildNextStepsInput> {
  const admin = requireAdmin();
  const [inputs, trainerAttempts, planning] = await Promise.all([
    loadGenerationInputs(supabase, studentId),
    admin
      .from("student_skill_trainer_attempts")
      .select("skill_trainer_id")
      .eq("student_id", studentId)
      .not("completed_at", "is", null),
    planningDateFor(profile),
  ]);
  if (trainerAttempts.error) throw trainerAttempts.error;
  const trainerAttemptCounts = new Map<string, number>();
  for (const attempt of trainerAttempts.data ?? []) {
    trainerAttemptCounts.set(
      attempt.skill_trainer_id,
      (trainerAttemptCounts.get(attempt.skill_trainer_id) ?? 0) + 1,
    );
  }
  return {
    ...options,
    planningDate: planning.planningDate,
    ...inputs,
    trainerAttemptCounts,
  };
}

async function getOrRefreshNextSteps(
  supabase: SupabaseClient<Database>,
  studentId: string,
  timezone: string,
  profile: ProfileRow,
): Promise<StudyGuidanceItem[]> {
  const admin = requireAdmin();
  const today = todayIso(new Date(), timezone);
  const [currentResult, incompleteReviewResult, latestActivity] =
    await Promise.all([
      admin
        .from("ucat_student_next_steps")
        .select("*")
        .eq("student_id", studentId)
        .order("position"),
      admin
        .from("student_ucat_attempt_reviews")
        .select("attempt_type, attempt_id")
        .eq("student_id", studentId)
        .is("completed_at", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      latestGuidanceActivity(studentId),
    ]);
  if (currentResult.error) throw currentResult.error;
  if (incompleteReviewResult.error) throw incompleteReviewResult.error;
  const current = currentResult.data ?? [];
  const latestAttemptReviewType = latestActivity
    ? reviewTypeForActivity(latestActivity.kind)
    : null;
  const incompleteReviewSource = incompleteReviewResult.data
    ? {
        attemptType: incompleteReviewResult.data.attempt_type as NonNullable<
          StudyGuidanceItem["sourceAttemptType"]
        >,
        attemptId: incompleteReviewResult.data.attempt_id,
      }
    : latestActivity && latestAttemptReviewType
      ? {
          attemptType: latestAttemptReviewType,
          attemptId: latestActivity.id,
        }
      : null;
  const currentTrigger = current[0]?.trigger_key ?? null;
  const currentCreatedAt = current[0]?.created_at ?? null;
  const triggerKey = resolveGuidanceTrigger({
    today,
    currentTrigger,
    currentCreatedAt,
    currentGeneratedOn: current[0]?.generated_on ?? null,
    latestActivity,
  });
  if (current.length >= 2 && triggerKey === currentTrigger) {
    return current.map(mapNextStep);
  }

  const incompleteReview = await describeIncompleteReview(
    studentId,
    incompleteReviewSource,
  );

  const buildInput = await loadNextStepBuildInput(
    supabase,
    studentId,
    profile,
    {
      today,
      dailyWarmup: triggerKey?.startsWith("daily:") ?? false,
      incompleteReview,
    },
  );
  const drafts = buildNextStepDrafts(buildInput);
  const nextTrigger = triggerKey ?? `daily:${today}`;
  const { data, error } = await admin
    .from("ucat_student_next_steps")
    .upsert(
      drafts.map((draft, index) => ({
        student_id: studentId,
        position: index + 1,
        trigger_key: nextTrigger,
        generated_on: today,
        task_type: draft.taskType,
        title: draft.title,
        description: draft.description,
        rationale: draft.rationale,
        estimated_minutes: draft.estimatedMinutes,
        section_id: draft.sectionId,
        question_stem_category_id: draft.questionStemCategoryId,
        learning_module_id: draft.learningModuleId,
        question_set_id: draft.questionSetId,
        mock_id: draft.mockId,
        skill_trainer_id: draft.skillTrainerId,
        source_attempt_type: draft.sourceAttemptType,
        source_attempt_id: draft.sourceAttemptId,
        launch_path: draft.launchPath,
        launch_config: draft.launchConfig as Json,
      })),
      { onConflict: "student_id,position" },
    )
    .select("*")
    .order("position");
  if (error) throw error;
  return (data ?? []).map(mapNextStep);
}

export async function suggestAlternativeStudyGuidance(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: StudyGuidanceAlternativeInput,
): Promise<StudyGuidanceItem> {
  const admin = requireAdmin();
  const student = await resolveStudent(userId);
  const today = todayIso(new Date(), student.timezone);
  const [profileResult, incompleteReviewResult] = await Promise.all([
    admin
      .from("ucat_student_study_plan_profiles")
      .select("*")
      .eq("student_id", student.id)
      .maybeSingle(),
    admin
      .from("student_ucat_attempt_reviews")
      .select("attempt_type, attempt_id")
      .eq("student_id", student.id)
      .is("completed_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (incompleteReviewResult.error) throw incompleteReviewResult.error;
  if (!profileResult.data) throw new Error("Set your UCAT goal first.");
  const incompleteReview = incompleteReviewResult.data;
  const describedIncompleteReview = await describeIncompleteReview(
    student.id,
    incompleteReview
      ? {
          attemptType: incompleteReview.attempt_type as NonNullable<
            StudyGuidanceItem["sourceAttemptType"]
          >,
          attemptId: incompleteReview.attempt_id,
        }
      : null,
  );
  const buildInput = await loadNextStepBuildInput(
    supabase,
    student.id,
    profileResult.data,
    {
      today,
      dailyWarmup: false,
      incompleteReview: describedIncompleteReview,
    },
  );
  const draft = buildAlternativeNextStep(buildInput, input);
  if (!draft)
    throw new Error("There are no more suitable alternatives right now.");
  return {
    id: `alternative:${randomUUID()}`,
    position: 1,
    triggerKey: `alternative:${today}`,
    generatedOn: today,
    ...draft,
  };
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
    .upsert(
      {
        student_id: studentId,
        study_plan_enabled: input.studyPlanEnabled,
        study_suggestions_enabled: input.studySuggestionsEnabled,
        target_score: input.targetScore,
        test_year: input.testYear,
        test_date: input.testDate,
        available_days: input.availableDays as unknown as Json,
        preferred_mock_weekday: input.preferredMockWeekday,
        setup_completed_at: new Date().toISOString(),
      },
      { onConflict: "student_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  const { error: clearStepsError } = await admin
    .from("ucat_student_next_steps")
    .delete()
    .eq("student_id", studentId);
  if (clearStepsError) throw clearStepsError;
  if (input.studyPlanEnabled) {
    await generateForProfile(
      supabase,
      studentId,
      profile,
      profile.last_generated_at ? "profile_changed" : "onboarding",
    );
  } else {
    const { error: retirePlanError } = await admin
      .from("ucat_student_study_plan_generations")
      .update({ superseded_at: new Date().toISOString() })
      .eq("student_id", studentId)
      .is("superseded_at", null);
    if (retirePlanError) throw retirePlanError;
  }
  return getStudyPlan(supabase, userId, { allowAutomaticReplan: false });
}

export async function createExtraStudyTask(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: StudyPlanExtraStudyInput,
): Promise<StudyPlanResponse> {
  const currentPlan = await getStudyPlan(supabase, userId, {
    allowAutomaticReplan: false,
  });
  if (!currentPlan.profile || !currentPlan.generation) {
    throw new ExtraStudyUnavailableError(
      "Set up your Study plan before adding extra study.",
    );
  }
  if (
    currentPlan.todayTasks.length > 0 &&
    !currentPlan.todayTasks.every((task) => task.status === "completed")
  ) {
    throw new ExtraStudyUnavailableError(
      "Finish today’s Study plan before adding another activity.",
    );
  }
  if (
    currentPlan.tasks.some(
      (task) =>
        task.scheduledDate < currentPlan.today &&
        task.status !== "completed" &&
        task.status !== "skipped",
    )
  ) {
    throw new ExtraStudyUnavailableError(
      "Finish or skip the tasks still waiting from an earlier study day before adding extra study.",
    );
  }

  const studentId = await resolveStudentId(userId);
  const generationInputs = await loadGenerationInputs(supabase, studentId);
  const nextSortOrder =
    Math.max(-1, ...currentPlan.todayTasks.map((task) => task.sortOrder)) + 1;
  const extraTasks = (() => {
    try {
      return generateExtraStudyTasks({
        ...input,
        today: currentPlan.today,
        planningDate: currentPlan.profile.planningDate,
        targetScore: currentPlan.profile.targetScore,
        sections: generationInputs.sections,
        signals: generationInputs.signals,
        categories: generationInputs.categories,
        skillTrainers: generationInputs.skillTrainers,
        sectionTargets: currentPlan.generation.sectionTargets,
        scheduledCategoryIds: currentPlan.tasks.map(
          (scheduledTask) => scheduledTask.questionStemCategoryId,
        ),
        sortOrder: nextSortOrder,
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("There are no")) {
        throw new ExtraStudyUnavailableError(error.message);
      }
      throw error;
    }
  })();
  const practiceTask = extraTasks.find((task) => task.taskType === "practice");
  const nextStudyDate = currentPlan.tasks
    .filter((task) => task.scheduledDate > currentPlan.today)
    .map((task) => task.scheduledDate)
    .sort()[0];
  const practiceMinutes = extraTasks.reduce(
    (total, extraTask) => total + extraTask.estimatedMinutes,
    0,
  );
  const review = practiceTask
    ? reviewTask(
        practiceTask,
        practiceMinutes +
          reviewTask(practiceTask, currentPlan.today, 0).estimatedMinutes <=
          input.minutes
          ? currentPlan.today
          : (nextStudyDate ?? currentPlan.today),
        0,
      )
    : null;
  const tasksToInsert = review
    ? [
        ...extraTasks,
        {
          ...review,
          sortOrder:
            review.scheduledDate === currentPlan.today
              ? nextSortOrder + extraTasks.length
              : Math.max(
                  -1,
                  ...currentPlan.tasks
                    .filter(
                      (task) => task.scheduledDate === review.scheduledDate,
                    )
                    .map((task) => task.sortOrder),
                ) + 1,
        },
      ]
    : extraTasks;
  const preparedTasks = prepareStudyPlanTasks(tasksToInsert, null, randomUUID);
  const { error } = await requireAdmin()
    .from("ucat_student_study_plan_tasks")
    .insert(
      preparedTasks.map((task) => ({
        id: task.id,
        generation_id: currentPlan.generation!.id,
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
        question_stem_category_id: task.questionStemCategoryId,
        question_tag_id: task.questionTagId,
        learning_module_id: task.learningModuleId,
        question_set_id: task.questionSetId,
        mock_id: task.mockId,
        skill_trainer_id: task.skillTrainerId,
        launch_path: task.launchPath,
        launch_config: task.launchConfig as Json,
        source_task_id: task.sourceTaskId,
      })),
    );
  if (error) throw error;

  return getStudyPlan(supabase, userId, { allowAutomaticReplan: false });
}

export async function getStudyPlan(
  supabase: SupabaseClient<Database>,
  userId: string,
  options: {
    allowAutomaticReplan?: boolean;
    reconcileTasks?: boolean;
  } = {},
): Promise<StudyPlanResponse> {
  const admin = requireAdmin();
  const student = await resolveStudent(userId);
  const studentId = student.id;
  const today = todayIso(new Date(), student.timezone);
  const [profileResult, initialGenerationResult] = await Promise.all([
    admin
      .from("ucat_student_study_plan_profiles")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle(),
    admin
      .from("ucat_student_study_plan_generations")
      .select("*")
      .eq("student_id", studentId)
      .is("superseded_at", null)
      .maybeSingle(),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (initialGenerationResult.error) throw initialGenerationResult.error;
  let profile = profileResult.data;
  if (!profile) {
    return {
      profile: null,
      generation: null,
      tasks: [],
      nextSteps: [],
      today,
      todayTasks: [],
      completion: { completed: 0, scheduledThroughToday: 0, percent: 0 },
    };
  }
  let generation = profile.study_plan_enabled
    ? initialGenerationResult.data
    : null;
  const latestCompletedMocks =
    generation && options.allowAutomaticReplan !== false
      ? await completedMockCount(studentId)
      : 0;
  const mockCompletedSinceGeneration = generation
    ? latestCompletedMocks > readCompletedMockCount(generation.input_snapshot)
    : false;
  if (
    profile.study_plan_enabled &&
    options.allowAutomaticReplan !== false &&
    (!generation ||
      mockCompletedSinceGeneration ||
      !profile.next_weekly_replan_on ||
      profile.next_weekly_replan_on <= today)
  ) {
    await generateForProfile(
      supabase,
      studentId,
      profile,
      !generation
        ? "onboarding"
        : mockCompletedSinceGeneration
          ? "mock_completed"
          : "weekly",
    );
    const [profileResult, generationResult] = await Promise.all([
      admin
        .from("ucat_student_study_plan_profiles")
        .select("*")
        .eq("id", profile.id)
        .single(),
      admin
        .from("ucat_student_study_plan_generations")
        .select("*")
        .eq("student_id", studentId)
        .is("superseded_at", null)
        .single(),
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
    if (options.reconcileTasks !== false) {
      await reconcileTasks(studentId, generation, taskRows);
      const refreshed = await admin
        .from("ucat_student_study_plan_tasks")
        .select("*")
        .eq("generation_id", generation.id)
        .order("scheduled_date")
        .order("sort_order");
      if (refreshed.error) throw refreshed.error;
      taskRows = refreshed.data ?? [];
      const completedBenchmarkSinceGeneration = taskRows.some(
        (task) =>
          task.task_type === "section_benchmark" &&
          task.status === "completed" &&
          task.completed_at != null &&
          task.completed_at >= generation!.generated_at,
      );
      if (
        options.allowAutomaticReplan !== false &&
        completedBenchmarkSinceGeneration
      ) {
        await generateForProfile(
          supabase,
          studentId,
          profile,
          "significant_activity",
        );
        const [nextProfileResult, nextGenerationResult] = await Promise.all([
          admin
            .from("ucat_student_study_plan_profiles")
            .select("*")
            .eq("id", profile.id)
            .single(),
          admin
            .from("ucat_student_study_plan_generations")
            .select("*")
            .eq("student_id", studentId)
            .is("superseded_at", null)
            .single(),
        ]);
        if (nextProfileResult.error) throw nextProfileResult.error;
        if (nextGenerationResult.error) throw nextGenerationResult.error;
        profile = nextProfileResult.data;
        generation = nextGenerationResult.data;
        const nextTaskResult = await admin
          .from("ucat_student_study_plan_tasks")
          .select("*")
          .eq("generation_id", generation.id)
          .order("scheduled_date")
          .order("sort_order");
        if (nextTaskResult.error) throw nextTaskResult.error;
        taskRows = nextTaskResult.data ?? [];
      }
    }
  }
  const planning = await planningDateFor(profile);
  const tasks = taskRows.map(mapTask);
  const nextSteps = profile.study_plan_enabled
    ? []
    : await getOrRefreshNextSteps(
        supabase,
        studentId,
        student.timezone,
        profile,
      );
  const scheduledThroughToday = tasks.filter(
    (task) => task.scheduledDate <= today && task.status !== "skipped",
  ).length;
  const completed = tasks.filter(
    (task) => task.scheduledDate <= today && task.status === "completed",
  ).length;
  return {
    profile: {
      id: profile.id,
      studyPlanEnabled: profile.study_plan_enabled,
      studySuggestionsEnabled: profile.study_suggestions_enabled,
      targetScore: profile.target_score,
      testYear: profile.test_year,
      testDate: profile.test_date,
      availableDays: parseAvailability(profile.available_days),
      preferredMockWeekday: profile.preferred_mock_weekday as
        | 0
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6,
      planningDate: planning.planningDate,
      planningDateIsProvisional: planning.provisional,
      nextWeeklyReplanOn: profile.next_weekly_replan_on,
    },
    generation: generation
      ? {
          id: generation.id,
          generatedAt: generation.generated_at,
          reason: generation.reason,
          startsOn: generation.starts_on,
          endsOn: generation.ends_on,
          capacityRisk: readCapacityRisk(generation.capacity_risk),
          sectionTargets: readSectionTargets(generation.projection_snapshot),
        }
      : null,
    tasks,
    nextSteps,
    today,
    todayTasks: tasks.filter((task) => task.scheduledDate === today),
    completion: {
      completed,
      scheduledThroughToday,
      percent: scheduledThroughToday
        ? Math.round((completed / scheduledThroughToday) * 100)
        : 0,
    },
  };
}

export async function updateStudyPlanTask(
  userId: string,
  taskId: string,
  action: "start" | "skip" | "unskip" | "complete",
): Promise<void> {
  const admin = requireAdmin();
  const studentId = await resolveStudentId(userId);
  const now = new Date().toISOString();
  const { data: task, error: taskError } = await admin
    .from("ucat_student_study_plan_tasks")
    .select(
      "id, status, task_type, generation_id, scheduled_date, sort_order, started_at",
    )
    .eq("id", taskId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (taskError) throw taskError;
  if (!task) throw new Error("Study plan task not found.");
  if (task.status === "completed") return;
  if (action === "skip" && task.scheduled_date > todayIso()) {
    throw new Error("Future Study plan tasks cannot be skipped yet.");
  }
  if (action === "unskip" && task.status !== "skipped") return;
  if (action === "complete" && task.task_type !== "review") {
    throw new Error("Only review tasks can be completed manually.");
  }
  const update =
    action === "start"
      ? { status: "in_progress", started_at: now, skipped_at: null }
      : action === "unskip"
        ? {
            status: task.started_at ? "in_progress" : "planned",
            skipped_at: null,
          }
        : action === "complete"
          ? { status: "completed", completed_at: now, completed_units: 1 }
          : { status: "skipped", skipped_at: now };
  const { error } = await admin
    .from("ucat_student_study_plan_tasks")
    .update(update)
    .eq("id", task.id);
  if (error) throw error;

  if (action === "skip" && task.task_type !== "review") {
    const { data: companion, error: companionError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("id")
      .eq("source_task_id", task.id)
      .maybeSingle();
    if (companionError) throw companionError;
    if (companion) {
      const { error: skipCompanionError } = await admin
        .from("ucat_student_study_plan_tasks")
        .update({ status: "skipped", skipped_at: now })
        .eq("id", companion.id);
      if (skipCompanionError) throw skipCompanionError;
    }
  }

  if (action === "unskip" && task.task_type !== "review") {
    const { data: companion, error: companionError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("id,status,started_at")
      .eq("source_task_id", task.id)
      .maybeSingle();
    if (companionError) throw companionError;
    if (companion?.status === "skipped") {
      const { error: unskipCompanionError } = await admin
        .from("ucat_student_study_plan_tasks")
        .update({
          status: companion.started_at ? "in_progress" : "planned",
          skipped_at: null,
        })
        .eq("id", companion.id);
      if (unskipCompanionError) throw unskipCompanionError;
    }
  }
}
