import "server-only";

import { randomUUID } from "node:crypto";
import type { Database, Json } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  CURRENT_PREPARATION_VERSIONS,
  parseRepresentativeScoreEvidence,
  prepareStudent,
  REPRESENTATIVE_SCORE_EVIDENCE_SELECT,
  STANDARD_PREPARATION_TIMING_PROFILE,
  type PreparationEngineResult,
  type PreparationEngineInput,
  type ActivityTagSignal,
  type RepresentativeScoreEvidence,
} from "@/features/preparation";
import {
  derivePreparationForecastEvidence,
  mergeCurrentPreparationHistory,
} from "@/features/preparation/lib/forecast-evidence";
import { learningLoopTargetQuestionCount } from "@/features/preparation/lib/policy";
import {
  hasPreparationSnapshot,
  loadPreparationSnapshotHistory,
  persistPreparationSnapshot,
} from "@/features/preparation/server/preparation-snapshot";
import { normalizeSjtPreference } from "@/features/preparation/lib/sjt-allocation-policy";
import type {
  BenchmarkMockAsset,
  BenchmarkSetAsset,
} from "@/features/preparation/lib/benchmark-selection";
import {
  PREPARATION_SANDBOX_PERSONAS,
  type PreparationSandboxCase,
} from "@/features/preparation/testing/sandbox";
import {
  extractTextFromRichJson,
  type JsonLike,
} from "@/features/question-engine/model/rich-text";
import {
  addDays,
  midpointDate,
  todayIso,
} from "@/features/study-plan/lib/dates";
import {
  estimateReviewMinutes,
  generateExtraStudyTasks,
  reviewTask,
} from "@/features/study-plan/lib/generator";
import {
  maximumTieredWholeStemDose,
  maximumWholeStemDose,
  pickStems,
  type PickStemsOptions,
} from "@/features/practice/server/pick-stems";
import { isLegacyDemandCapacityRiskMessage } from "@/features/study-plan/lib/capacity-risk-copy";
import { expandQuestionTagIds } from "@/features/study-plan/lib/tag-hierarchy";
import {
  countPracticeQuestionsByCategory,
  deriveActivityTagSignals,
} from "@/features/study-plan/lib/practice-inventory";
import {
  needsPreparationVersionReplacement,
  planProfileTransition,
  prepareStudyPlanTasks,
} from "@/features/study-plan/lib/persistence";
import {
  buildAlternativeNextStep,
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
  StudyGuidanceAlternativeInput,
  StudyGuidanceItem,
  StudyPlanLearningModule,
  StudyPlanProfileInput,
  StudyPlanReadinessSnapshot,
  StudyPlanResponse,
  StudyPlanSection,
  StudyPlanSectionSignal,
  StudyPlanSkillTrainer,
  StudyPlanTask,
  StudyPlanTaskStatus,
  StudyPlanTimingEvidenceSession,
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
    ["VR", "DM", "QR", "SJ"][sectionNumber - 1] ?? `Section ${sectionNumber}`
  );
}

function taskStatus(value: string): StudyPlanTaskStatus {
  if (
    value === "planned" ||
    value === "in_progress" ||
    value === "partial" ||
    value === "completed" ||
    value === "skipped"
  ) {
    return value;
  }
  return "planned";
}

function parseAvailability(
  value: Json,
): StudyPlanProfileInput["availableDays"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const weekday = item.weekday;
    if (typeof weekday !== "number" || weekday < 0 || weekday > 6) return [];
    return [{ weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6 }];
  });
}

function profileInput(profile: ProfileRow): StudyPlanProfileInput {
  return {
    studyPlanEnabled: profile.study_plan_enabled,
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
    sjtPreference: normalizeSjtPreference(profile.sjt_preference),
  };
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

async function loadGenerationInputs(
  supabase: SupabaseClient<Database>,
  studentId: string,
  testYear: number,
  options: { includeScoreEvidence?: boolean } = {},
): Promise<{
  sections: StudyPlanSection[];
  signals: StudyPlanSectionSignal[];
  categories: StudyPlanCategorySignal[];
  learningModules: StudyPlanLearningModule[];
  skillTrainers: StudyPlanSkillTrainer[];
  timingSessions: StudyPlanTimingEvidenceSession[];
  scoreEvidence: RepresentativeScoreEvidence[];
  completedMockCount: number;
  tagSignals: ActivityTagSignal[];
  benchmarkSets: BenchmarkSetAsset[];
  benchmarkMocks: BenchmarkMockAsset[];
  lastLearningModuleServedAtBySection: Record<string, string>;
  practiceSelectionData: NonNullable<PickStemsOptions["preloaded"]>;
}> {
  const admin = requireAdmin();
  const scoreEvidenceQuery =
    options.includeScoreEvidence === false
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("vstudent_ucat_score_projection_evidence")
          .select(REPRESENTATIVE_SCORE_EVIDENCE_SELECT);
  const [
    sectionsRes,
    evidenceRes,
    fullSetRes,
    completedBenchmarksRes,
    categoriesRes,
    categoryProgressRes,
    readinessEvidenceRes,
    modulesRes,
    moduleCategoriesRes,
    moduleTagsRes,
    tagTaxonomyRes,
    trainersRes,
    trainerCategoriesRes,
    trainerItemsRes,
    trainerConfigsRes,
    mockRes,
    graduationStatesRes,
    timingEvidenceRes,
    setCatalogRes,
    setAttemptsRes,
    mockCatalogRes,
    mockAttemptsRes,
    practiceInventoryRes,
    lastLearningTasksRes,
    practiceAttemptsRes,
  ] = await Promise.all([
    admin
      .from("ucat_sections")
      .select(
        "id, name, section_number, number_of_questions, time_per_question",
      )
      .order("section_number"),
    scoreEvidenceQuery,
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
      .from("vstudent_ucat_my_question_progress")
      .select("category_id, correct_score, max_score"),
    supabase
      .from("vstudent_ucat_study_plan_readiness_evidence")
      .select(
        "section_id, category_id, readiness_scope, attempted_question_count, completed_practice_sessions, qualifying_practice_sessions, largest_practice_session_question_count, recent_accuracy, observed_pace",
      ),
    supabase
      .from("vstudent_ucat_learning_modules")
      .select(
        "id, title, kind, ucat_section_id, study_plan_priority, estimated_minutes, completion_percent, parent_ucat_learning_module_id, index",
      )
      .neq("study_plan_priority", "excluded"),
    admin
      .from("ucat_learning_module_question_stem_categories")
      .select("learning_module_id, question_stem_category_id"),
    admin
      .from("ucat_learning_module_question_tags")
      .select("learning_module_id, question_tag_id"),
    admin.from("question_tags").select("id, parent_question_tag_id"),
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
    supabase
      .from("vstudent_ucat_preparation_section_states")
      .select(
        "section_id, learning_graduated_at, learning_graduation_route, policy_version, prescribed_pace, prescribed_pace_set_at, pace_policy_version",
      )
      .eq("test_year", testYear),
    supabase
      .from("vstudent_ucat_preparation_timing_evidence")
      .select(
        "evidence_session_id, source, section_id, completed_at, prescribed_pace, observed_pace, accuracy, section_equivalents, category_ids, breadth",
      ),
    supabase
      .from("vstudent_ucat_question_sets")
      .select(
        "id, name, sections, speed, time_limit_at_exam_speed_seconds, is_available_in_sets_library",
      )
      .eq("is_available_in_sets_library", true),
    supabase
      .from("vstudent_ucat_my_set_attempts")
      .select("question_set_id, completed_at, student_ucat_mock_attempt_id")
      .not("completed_at", "is", null),
    supabase.from("vstudent_ucat_mocks").select("id, name"),
    supabase
      .from("vstudent_ucat_my_mock_attempts")
      .select("ucat_mock_id, completed_at")
      .not("completed_at", "is", null),
    supabase
      .from("vstudent_ucat_practice_stem_index")
      .select(
        "id, section_id, question_stem_category_id, question_ids, question_tag_ids",
      ),
    admin
      .from("ucat_student_study_plan_tasks")
      .select("section_id, scheduled_date, started_at, completed_at")
      .eq("student_id", studentId)
      .eq("task_type", "learn")
      .in("status", ["in_progress", "completed"])
      .not("section_id", "is", null),
    supabase
      .from("vstudent_ucat_my_question_attempts")
      .select(
        "id, question_id, score, is_submitted, student_practice_session_id, student_question_set_attempt_id",
      ),
  ]);
  for (const [source, result] of [
    ["sections", sectionsRes],
    ["score evidence", evidenceRes],
    ["completed sets", fullSetRes],
    ["completed benchmarks", completedBenchmarksRes],
    ["categories", categoriesRes],
    ["category progress", categoryProgressRes],
    ["readiness evidence", readinessEvidenceRes],
    ["learning modules", modulesRes],
    ["learning module categories", moduleCategoriesRes],
    ["learning module tags", moduleTagsRes],
    ["question tag taxonomy", tagTaxonomyRes],
    ["skill trainers", trainersRes],
    ["skill trainer categories", trainerCategoriesRes],
    ["skill trainer items", trainerItemsRes],
    ["skill trainer configuration", trainerConfigsRes],
    ["completed mocks", mockRes],
    ["graduation states", graduationStatesRes],
    ["timing evidence", timingEvidenceRes],
    ["set catalog", setCatalogRes],
    ["set attempts", setAttemptsRes],
    ["mock catalog", mockCatalogRes],
    ["mock attempts", mockAttemptsRes],
    ["practice inventory", practiceInventoryRes],
    ["learning history", lastLearningTasksRes],
    ["practice attempts", practiceAttemptsRes],
  ] as const) {
    if (result.error) {
      throw new Error(
        `Failed to load Study plan ${source}: ${result.error.message}`,
      );
    }
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
  const scoreEvidence: RepresentativeScoreEvidence[] = (
    evidenceRes.data ?? []
  ).flatMap((row) => {
    const evidence = parseRepresentativeScoreEvidence(row);
    return evidence ? [evidence] : [];
  });
  const graduationBySection = new Map(
    (graduationStatesRes.data ?? []).map((state) => [state.section_id, state]),
  );
  const signals = sections.map((section) => {
    const readinessEvidence = (readinessEvidenceRes.data ?? []).find(
      (row) =>
        row.readiness_scope === "section" && row.section_id === section.id,
    );
    const completedTiming = (timingEvidenceRes.data ?? []).filter(
      (row) => row.section_id === section.id,
    );
    const representativeTiming = completedTiming.filter(
      (row) =>
        row.breadth !== "narrow" &&
        (row.prescribed_pace ?? row.observed_pace ?? 0) >= 0.5,
    );
    const representativeEquivalents = representativeTiming.reduce(
      (sum, row) => sum + Math.max(0, row.section_equivalents ?? 0),
      0,
    );
    const representativeAccuracyWeight = representativeTiming.reduce(
      (sum, row) =>
        sum +
        (row.accuracy == null ? 0 : Math.max(0, row.section_equivalents ?? 0)),
      0,
    );
    const representativeAccuracyScore = representativeTiming.reduce(
      (sum, row) =>
        sum + (row.accuracy ?? 0) * Math.max(0, row.section_equivalents ?? 0),
      0,
    );
    const targetedTiming = completedTiming.filter(
      (row) =>
        row.source === "practice" && (row.section_equivalents ?? 0) < 0.9,
    );
    const targetedEquivalents = targetedTiming.reduce(
      (sum, row) => sum + Math.max(0, row.section_equivalents ?? 0),
      0,
    );
    const timingBenchmark = [...representativeTiming]
      .filter((row) => (row.section_equivalents ?? 0) >= 0.9)
      .sort((left, right) =>
        (right.completed_at ?? "").localeCompare(left.completed_at ?? ""),
      )[0];
    const graduation = graduationBySection.get(section.id);
    const learningGraduationRoute: "accuracy" | "experience" | null =
      graduation?.learning_graduation_route === "accuracy" ||
      graduation?.learning_graduation_route === "experience"
        ? graduation.learning_graduation_route
        : null;
    return {
      sectionId: section.id,
      currentEstimate: null,
      evidenceCount: 0,
      scoreConfidence: null,
      completedFullSets: fullSets.get(section.id) ?? 0,
      attemptedQuestionCount: readinessEvidence?.attempted_question_count ?? 0,
      completedPracticeSessions:
        readinessEvidence?.completed_practice_sessions ?? 0,
      qualifyingPracticeSessions:
        readinessEvidence?.qualifying_practice_sessions ?? 0,
      largestPracticeSessionQuestionCount:
        readinessEvidence?.largest_practice_session_question_count ?? 0,
      recentAccuracy: readinessEvidence?.recent_accuracy ?? null,
      observedPace: readinessEvidence?.observed_pace ?? null,
      representativeSessionCount: representativeTiming.length,
      representativeSectionEquivalents: representativeEquivalents,
      representativeAccuracy:
        representativeAccuracyWeight > 0
          ? representativeAccuracyScore / representativeAccuracyWeight
          : null,
      targetedPracticeSessionCount: targetedTiming.length,
      targetedSectionEquivalents: targetedEquivalents,
      benchmarkCompleted:
        timingBenchmark != null || (fullSets.get(section.id) ?? 0) > 0,
      benchmarkAccuracy: timingBenchmark?.accuracy ?? null,
      benchmarkPace:
        timingBenchmark?.prescribed_pace ??
        timingBenchmark?.observed_pace ??
        null,
      learningGraduatedAt: graduation?.learning_graduated_at ?? null,
      learningGraduationRoute,
      learningGraduationPolicyVersion: graduation?.policy_version ?? null,
      prescribedPace: graduation?.prescribed_pace ?? null,
      prescribedPaceSetAt: graduation?.prescribed_pace_set_at ?? null,
      pacePolicyVersion: graduation?.pace_policy_version ?? null,
    };
  });
  const categoryCounts = countPracticeQuestionsByCategory(
    practiceInventoryRes.data ?? [],
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
    const readinessEvidence = (readinessEvidenceRes.data ?? []).find(
      (row) =>
        row.readiness_scope === "category" && row.category_id === category.id,
    );
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
        attemptedQuestionCount:
          readinessEvidence?.attempted_question_count ?? 0,
        completedPracticeSessions:
          readinessEvidence?.completed_practice_sessions ?? 0,
        qualifyingPracticeSessions:
          readinessEvidence?.qualifying_practice_sessions ?? 0,
        largestPracticeSessionQuestionCount:
          readinessEvidence?.largest_practice_session_question_count ?? 0,
        recentAccuracy: readinessEvidence?.recent_accuracy ?? null,
        observedPace: readinessEvidence?.observed_pace ?? null,
      },
    ];
  });
  const categorySignals = new Map(
    categories.map((category) => [category.id, category]),
  );
  const attemptsByQuestionId = new Map<
    string,
    Array<{ score: number | null; isSubmitted: boolean }>
  >();
  for (const attempt of practiceAttemptsRes.data ?? []) {
    if (!attempt.question_id) continue;
    attemptsByQuestionId.set(attempt.question_id, [
      ...(attemptsByQuestionId.get(attempt.question_id) ?? []),
      { score: attempt.score, isSubmitted: attempt.is_submitted === true },
    ]);
  }
  const questionStatus = (questionId: string) => {
    const attempts = (attemptsByQuestionId.get(questionId) ?? []).filter(
      (attempt) => attempt.isSubmitted,
    );
    if (!attempts.length) return "unanswered" as const;
    return attempts.some((attempt) => (attempt.score ?? 0) > 0)
      ? ("correct" as const)
      : ("incorrect" as const);
  };
  const moduleRows = modulesRes.data ?? [];
  const childrenByParent = new Map<string | null, typeof moduleRows>();
  for (const moduleRow of moduleRows) {
    const parentId = moduleRow.parent_ucat_learning_module_id ?? null;
    childrenByParent.set(parentId, [
      ...(childrenByParent.get(parentId) ?? []),
      moduleRow,
    ]);
  }
  const authoredOrderByModuleId = new Map<string, number>();
  let authoredOrder = 0;
  const visitModules = (parentId: string | null): void => {
    const children = [...(childrenByParent.get(parentId) ?? [])].sort(
      (left, right) =>
        (left.index ?? 0) - (right.index ?? 0) ||
        (left.id ?? "").localeCompare(right.id ?? ""),
    );
    for (const child of children) {
      if (!child.id) continue;
      if (child.kind === "lesson") {
        authoredOrderByModuleId.set(child.id, authoredOrder++);
      }
      visitModules(child.id);
    }
  };
  visitModules(null);
  const learningModules: StudyPlanLearningModule[] = moduleRows.flatMap(
    (moduleRow) => {
      if (
        !moduleRow.id ||
        !moduleRow.title ||
        moduleRow.kind !== "lesson" ||
        moduleRow.study_plan_priority === "excluded"
      )
        return [];
      const categoryIds = (moduleCategoriesRes.data ?? [])
        .filter((link) => link.learning_module_id === moduleRow.id)
        .map((link) => link.question_stem_category_id);
      const categoryScores = categoryIds.flatMap((categoryId) => {
        const signal = categorySignals.get(categoryId);
        return signal ? [signal.weaknessScore] : [];
      });
      const authoredQuestionTagIds = (moduleTagsRes.data ?? [])
        .filter((link) => link.learning_module_id === moduleRow.id)
        .map((link) => link.question_tag_id);
      const questionTagIds = expandQuestionTagIds(
        authoredQuestionTagIds,
        tagTaxonomyRes.data ?? [],
      );
      const strictStems = (practiceInventoryRes.data ?? []).filter(
        (stem) =>
          stem.section_id === moduleRow.ucat_section_id &&
          (categoryIds.length === 0 ||
            (stem.question_stem_category_id != null &&
              categoryIds.includes(stem.question_stem_category_id))),
      );
      const preferredTagStems = strictStems.filter((stem) =>
        (stem.question_tag_ids ?? []).some((tagId) =>
          questionTagIds.includes(tagId),
        ),
      );
      const tierQuestionCounts = [0, 1, 2, 3].map((tier) =>
        strictStems.flatMap((stem) => {
          const statuses = (stem.question_ids ?? []).map(questionStatus);
          const allUnanswered = statuses.every(
            (status) => status === "unanswered",
          );
          const anyIncorrect = statuses.some(
            (status) => status === "incorrect",
          );
          const tagMatched = (stem.question_tag_ids ?? []).some((tagId) =>
            questionTagIds.includes(tagId),
          );
          const stemTier = allUnanswered
            ? tagMatched
              ? 0
              : 1
            : tagMatched && anyIncorrect
              ? 2
              : 3;
          return stemTier === tier ? [stem.question_ids?.length ?? 0] : [];
        }),
      );
      const section = sections.find(
        (item) => item.id === moduleRow.ucat_section_id,
      );
      const requestedQuestionCount = learningLoopTargetQuestionCount(
        section?.questionCount ?? 10,
      );
      let remainingTarget = requestedQuestionCount;
      const selectedDoseByTier = tierQuestionCounts.map((questionCounts) => {
        const dose = maximumWholeStemDose(questionCounts, remainingTarget);
        remainingTarget -= dose;
        return dose;
      });
      return [
        {
          id: moduleRow.id,
          title: moduleRow.title,
          sectionId: moduleRow.ucat_section_id,
          sectionNumber:
            sections.find((section) => section.id === moduleRow.ucat_section_id)
              ?.sectionNumber ?? null,
          priority: moduleRow.study_plan_priority ?? "recommended",
          estimatedMinutes: Math.max(5, moduleRow.estimated_minutes ?? 5),
          completionPercent: moduleRow.completion_percent ?? 0,
          authoredOrder:
            authoredOrderByModuleId.get(moduleRow.id) ??
            Number.MAX_SAFE_INTEGER,
          categoryIds,
          questionTagIds,
          targetedPracticeInventory: {
            strictStemCount: strictStems.length,
            strictQuestionCount: strictStems.reduce(
              (sum, stem) => sum + (stem.question_ids?.length ?? 0),
              0,
            ),
            preferredTagStemCount: preferredTagStems.length,
            preferredTagQuestionCount: preferredTagStems.reduce(
              (sum, stem) => sum + (stem.question_ids?.length ?? 0),
              0,
            ),
            strictSelectableQuestionCount: maximumTieredWholeStemDose(
              tierQuestionCounts,
              requestedQuestionCount,
            ),
            preferredTagSelectableQuestionCount:
              selectedDoseByTier[0] + selectedDoseByTier[2],
          },
          relevanceScore: categoryScores.length
            ? categoryScores.reduce((sum, score) => sum + score, 0) /
              categoryScores.length
            : 0.3,
        },
      ];
    },
  );
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
  const timingSessions: StudyPlanTimingEvidenceSession[] = (
    timingEvidenceRes.data ?? []
  ).flatMap((row) => {
    if (
      !row.evidence_session_id ||
      !row.section_id ||
      !row.completed_at ||
      (row.source !== "practice" &&
        row.source !== "set" &&
        row.source !== "mock") ||
      (row.breadth !== "broad" &&
        row.breadth !== "mixed" &&
        row.breadth !== "narrow")
    ) {
      return [];
    }
    return [
      {
        id: row.evidence_session_id,
        sectionId: row.section_id,
        source: row.source,
        completedAt: row.completed_at,
        prescribedPace: row.prescribed_pace,
        observedPace: row.observed_pace,
        accuracy: row.accuracy,
        sectionEquivalents: Math.max(0, row.section_equivalents ?? 0),
        breadth: row.breadth,
        categoryIds: row.category_ids ?? [],
      },
    ];
  });
  const tagSignals: ActivityTagSignal[] = deriveActivityTagSignals(
    practiceInventoryRes.data ?? [],
    practiceAttemptsRes.data ?? [],
  );
  const benchmarkSets: BenchmarkSetAsset[] = (setCatalogRes.data ?? []).flatMap(
    (set) => {
      if (
        !set.id ||
        !Array.isArray(set.sections) ||
        set.sections.length !== 1
      ) {
        return [];
      }
      const sectionJson = set.sections[0];
      if (
        sectionJson == null ||
        typeof sectionJson !== "object" ||
        Array.isArray(sectionJson)
      ) {
        return [];
      }
      const sectionNumber = Number(sectionJson.section_number);
      const section = sections.find(
        (candidate) => candidate.sectionNumber === sectionNumber,
      );
      const examSeconds = Number(set.time_limit_at_exam_speed_seconds ?? 0);
      const pace = Number(set.speed ?? 0);
      if (!section || examSeconds <= 0 || pace <= 0) return [];
      return [
        {
          id: set.id,
          name:
            extractTextFromRichJson(set.name as JsonLike).trim() ||
            `${section.shortName} set`,
          sectionId: section.id,
          questionCount: Math.max(
            1,
            Math.round(examSeconds / section.timePerQuestionSeconds),
          ),
          pace,
          completedAttempts: (setAttemptsRes.data ?? []).flatMap((attempt) =>
            attempt.question_set_id === set.id &&
            attempt.student_ucat_mock_attempt_id == null &&
            attempt.completed_at
              ? [attempt.completed_at]
              : [],
          ),
        },
      ];
    },
  );
  const benchmarkMocks: BenchmarkMockAsset[] = (
    mockCatalogRes.data ?? []
  ).flatMap((mock) =>
    mock.id
      ? [
          {
            id: mock.id,
            name: mock.name?.trim() || "UCAT mock",
            completedAttempts: (mockAttemptsRes.data ?? []).flatMap(
              (attempt) =>
                attempt.ucat_mock_id === mock.id && attempt.completed_at
                  ? [attempt.completed_at]
                  : [],
            ),
          },
        ]
      : [],
  );
  const lastLearningModuleServedAtBySection = Object.fromEntries(
    [...(lastLearningTasksRes.data ?? [])]
      .filter((task) => task.section_id)
      .sort((left, right) => {
        const leftAt =
          left.completed_at ?? left.started_at ?? left.scheduled_date;
        const rightAt =
          right.completed_at ?? right.started_at ?? right.scheduled_date;
        return rightAt.localeCompare(leftAt);
      })
      .flatMap((task) =>
        task.section_id
          ? [
              [
                task.section_id,
                task.completed_at ?? task.started_at ?? task.scheduled_date,
              ],
            ]
          : [],
      )
      .filter(
        ([sectionId], index, rows) =>
          rows.findIndex(([candidate]) => candidate === sectionId) === index,
      ),
  );
  return {
    sections,
    signals,
    categories,
    learningModules,
    skillTrainers,
    timingSessions,
    scoreEvidence,
    tagSignals,
    completedMockCount: mockRes.count ?? 0,
    benchmarkSets,
    benchmarkMocks,
    lastLearningModuleServedAtBySection,
    practiceSelectionData: {
      sections: sections.map((section) => ({
        id: section.id,
        section_number: section.sectionNumber,
        time_per_question: section.timePerQuestionSeconds,
        number_of_questions: section.questionCount,
      })),
      stems: (practiceInventoryRes.data ?? []).flatMap((stem) =>
        stem.id && stem.section_id
          ? [
              {
                id: stem.id,
                section_id: stem.section_id,
                question_stem_category_id: stem.question_stem_category_id,
                question_ids: stem.question_ids,
                question_tag_ids: stem.question_tag_ids,
              },
            ]
          : [],
      ),
      attempts: (practiceAttemptsRes.data ?? []).flatMap((attempt) =>
        attempt.question_id
          ? [
              {
                question_id: attempt.question_id,
                score: attempt.score,
                is_submitted: attempt.is_submitted === true,
              },
            ]
          : [],
      ),
    },
  };
}

/** Read-only development catalog case for the Preparation sandbox. */
export async function loadDevelopmentCatalogSandboxCase(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PreparationSandboxCase> {
  const student = await resolveStudent(userId);
  const base = PREPARATION_SANDBOX_PERSONAS["new-student"];
  const inputs = await loadGenerationInputs(
    supabase,
    student.id,
    base.input.goal.profile.testYear,
    { includeScoreEvidence: false },
  );
  const catalogCase: PreparationSandboxCase = {
    ...base,
    key: "development-catalog",
    label: "Development catalog",
    description:
      "Synthetic preparation evidence fulfilled against the real development catalog and the signed-in tester's real Practice attempt history.",
    input: {
      ...base.input,
      seed: "sandbox:development-catalog:v1",
      content: {
        sections: inputs.sections,
        categories: inputs.categories,
        learningModules: inputs.learningModules,
        skillTrainers: inputs.skillTrainers,
        tagSignals: inputs.tagSignals,
        benchmarkSets: inputs.benchmarkSets,
        benchmarkMocks: inputs.benchmarkMocks,
      },
      evidence: {
        sectionSignals: inputs.sections.map((section) => ({
          sectionId: section.id,
          currentEstimate: null,
          evidenceCount: 0,
          completedFullSets: 0,
        })),
        completedMockCount: 0,
        lastLearningModuleServedAtBySection:
          inputs.lastLearningModuleServedAtBySection,
      },
    },
  };
  const preliminary = prepareStudent(catalogCase.input);
  const scheduledModuleIds = new Set(
    preliminary.plan.tasks.flatMap((task) =>
      task.taskType === "learn" && task.learningModuleId
        ? [task.learningModuleId]
        : [],
    ),
  );
  const diagnostics = new Map(
    await Promise.all(
      catalogCase.input.content.learningModules
        .filter((module) => scheduledModuleIds.has(module.id))
        .flatMap((module) => {
          const section = catalogCase.input.content.sections.find(
            (candidate) => candidate.id === module.sectionId,
          );
          if (!section) return [];
          return [
            pickStems(
              supabase,
              {
                section: section.key,
                questionCount: learningLoopTargetQuestionCount(
                  section.questionCount,
                ),
                categoryIds: module.categoryIds ?? [],
                questionTagIds: module.questionTagIds ?? [],
                linkedLearningPractice: true,
                unansweredOnly: false,
                incorrectOnly: false,
                timeMode: "off",
                timeSpeedMultiplier: 1,
                customTimeMinutes: null,
                timePerQuestionSeconds: null,
              },
              {
                allowOversizedFallback: false,
                deterministic: true,
                preloaded: inputs.practiceSelectionData,
              },
            ).then((result) => [module.id, result] as const),
          ];
        }),
    ),
  );
  return {
    ...catalogCase,
    input: {
      ...catalogCase.input,
      content: {
        ...catalogCase.input.content,
        learningModules: catalogCase.input.content.learningModules.map(
          (module) => {
            const diagnostic = diagnostics.get(module.id);
            if (!diagnostic) return module;
            return {
              ...module,
              targetedPracticeInventory: {
                ...(module.targetedPracticeInventory ?? {
                  strictStemCount: 0,
                  strictQuestionCount: 0,
                  preferredTagStemCount: 0,
                  preferredTagQuestionCount: 0,
                }),
                strictSelectableQuestionCount: diagnostic.questionCount,
                selectedStemIds: diagnostic.chosenStemIds,
                selectionTrace: diagnostic.selectionTrace,
              },
            };
          },
        ),
      },
    },
  };
}

async function persistPreparationProgression(
  studentId: string,
  testYear: number,
  preparation: PreparationEngineResult,
): Promise<void> {
  const graduationEvents = preparation.progressionEvents.filter(
    (event) => event.type === "learning_graduated",
  );
  const rows = graduationEvents.map((event) => ({
    student_id: studentId,
    test_year: testYear,
    section_id: event.sectionId,
    learning_graduated_at: event.occurredAt,
    learning_graduation_route: event.route,
    policy_version: event.policyVersion,
    evidence_snapshot: {
      assessment: preparation.assessment.sections.find(
        (section) => section.sectionId === event.sectionId,
      ),
      score: preparation.currentScore.sections.find(
        (section) => section.sectionId === event.sectionId,
      ),
    },
  }));
  const admin = requireAdmin();
  if (rows.length) {
    const { error } = await admin
      .from("ucat_student_preparation_section_states")
      .upsert(rows, {
        onConflict: "student_id,test_year,section_id",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }
  const timingEvents = preparation.progressionEvents.filter(
    (event) => event.type === "timing_pace_changed",
  );
  await Promise.all(
    timingEvents.map(async (event) => {
      const { error } = await admin
        .from("ucat_student_preparation_section_states")
        .update({
          prescribed_pace: event.toPace,
          prescribed_pace_set_at: event.occurredAt,
          pace_policy_version: event.policyVersion,
          timing_evidence_snapshot: {
            reason: event.reason,
            assessment: preparation.assessment.sections.find(
              (section) => section.sectionId === event.sectionId,
            ),
          },
        })
        .eq("student_id", studentId)
        .eq("test_year", testYear)
        .eq("section_id", event.sectionId);
      if (error) throw error;
    }),
  );
}

async function persistGeneration(
  studentId: string,
  profile: ProfileRow,
  planningDate: string,
  preparation: PreparationEngineResult,
  reason: StudyPlanReason,
  completedMockCount: number,
  signals: StudyPlanSectionSignal[],
): Promise<void> {
  const admin = requireAdmin();
  const result = preparation.plan;
  const generatedAt = preparation.generatedAt;
  const preserveThrough = reason === "onboarding" ? null : todayIso();
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
        .update({ status: "skipped", skipped_at: generatedAt })
        .eq("generation_id", activeGeneration.id)
        .lt("scheduled_date", preserveThrough)
        .in("status", ["planned", "partial"]);
      if (missedWorkError) throw missedWorkError;
    }
  }
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
    p_next_weekly_replan_on: addDays(todayIso(), 7),
    p_setup_completed_at: profile.setup_completed_at ?? generatedAt,
    p_preserve_through: preserveThrough ?? undefined,
  });
  if (error) throw error;
}

async function loadForecastEvidence(
  supabase: SupabaseClient<Database>,
  studentId: string,
  today: string,
  timingSessions: StudyPlanTimingEvidenceSession[],
  sections: StudyPlanSection[],
) {
  const admin = requireAdmin();
  const [generationResult, preparationHistory] = await Promise.all([
    admin
      .from("ucat_student_study_plan_generations")
      .select("id, generated_at, superseded_at, projection_snapshot")
      .eq("student_id", studentId)
      .order("generated_at", { ascending: false }),
    loadPreparationSnapshotHistory(supabase),
  ]);
  const { data: generations, error: generationError } = generationResult;
  if (generationError) throw generationError;

  const activeGeneration = (generations ?? []).find(
    (generation) => generation.superseded_at == null,
  );
  let tasks: Array<{
    scheduled_date: string;
    status: string;
    launch_config: Json;
  }> = [];
  if (activeGeneration) {
    const { data: taskRows, error: tasksError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("status, scheduled_date, launch_config")
      .eq("generation_id", activeGeneration.id);
    if (tasksError) throw tasksError;
    tasks = taskRows ?? [];
  }

  return derivePreparationForecastEvidence({
    today,
    versions: CURRENT_PREPARATION_VERSIONS,
    activePlanSnapshot: activeGeneration
      ? {
          generatedAt: activeGeneration.generated_at,
          projectionSnapshot: activeGeneration.projection_snapshot,
        }
      : null,
    historySnapshots: [
      ...(generations ?? []).map((generation) => ({
        generatedAt: generation.generated_at,
        projectionSnapshot: generation.projection_snapshot,
      })),
      ...preparationHistory,
    ],
    activeGenerationTasks: tasks.map((task) => ({
      scheduledDate: task.scheduled_date,
      status: taskStatus(task.status),
      optional:
        task.launch_config != null &&
        typeof task.launch_config === "object" &&
        !Array.isArray(task.launch_config) &&
        task.launch_config.optional === true,
    })),
    timingSessions,
    cognitiveSectionIds: new Set(
      sections
        .filter((section) => section.sectionNumber <= 3)
        .map((section) => section.id),
    ),
  });
}

type CanonicalPreparationInputs = {
  sections: StudyPlanSection[];
  signals: StudyPlanSectionSignal[];
  categories: StudyPlanCategorySignal[];
  learningModules: StudyPlanLearningModule[];
  skillTrainers: StudyPlanSkillTrainer[];
  tagSignals?: ActivityTagSignal[];
  timingSessions: StudyPlanTimingEvidenceSession[];
  scoreEvidence: RepresentativeScoreEvidence[];
  completedMockCount: number;
  benchmarkSets: BenchmarkSetAsset[];
  benchmarkMocks: BenchmarkMockAsset[];
  lastLearningModuleServedAtBySection: Record<string, string>;
};

async function runCanonicalPreparation(input: {
  supabase: SupabaseClient<Database>;
  studentId: string;
  profile: StudyPlanProfileInput;
  planningDate: string;
  inputs: CanonicalPreparationInputs;
  today: string;
  now: string;
  seed: string;
  guidance?: PreparationEngineInput["guidance"];
}): Promise<PreparationEngineResult> {
  const forecast = await loadForecastEvidence(
    input.supabase,
    input.studentId,
    input.today,
    input.inputs.timingSessions,
    input.inputs.sections,
  );
  return prepareStudent({
    clock: { now: input.now, today: input.today },
    seed: input.seed,
    versions: CURRENT_PREPARATION_VERSIONS,
    timingProfile: STANDARD_PREPARATION_TIMING_PROFILE,
    goal: { planningDate: input.planningDate, profile: input.profile },
    content: {
      sections: input.inputs.sections,
      categories: input.inputs.categories,
      learningModules: input.inputs.learningModules,
      skillTrainers: input.inputs.skillTrainers,
      tagSignals: input.inputs.tagSignals,
      benchmarkSets: input.inputs.benchmarkSets,
      benchmarkMocks: input.inputs.benchmarkMocks,
    },
    evidence: {
      sectionSignals: input.inputs.signals,
      timingSessions: input.inputs.timingSessions,
      scoreEvidence: input.inputs.scoreEvidence,
      completedMockCount: input.inputs.completedMockCount,
      lastLearningModuleServedAtBySection:
        input.inputs.lastLearningModuleServedAtBySection,
      forecast,
    },
    guidance: input.guidance,
  });
}

async function generateForProfile(
  supabase: SupabaseClient<Database>,
  studentId: string,
  profile: ProfileRow,
  reason: StudyPlanReason,
): Promise<void> {
  const { planningDate } = await planningDateFor(profile);
  const inputs = await loadGenerationInputs(
    supabase,
    studentId,
    profile.test_year,
  );
  const now = new Date();
  const today = todayIso(now);
  const generatedPreparation = await runCanonicalPreparation({
    supabase,
    studentId,
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
    studentId,
    profile.test_year,
    preparation,
  );
  await persistGeneration(
    studentId,
    profile,
    planningDate,
    preparation,
    reason,
    inputs.completedMockCount,
    inputs.signals,
  );
}

export async function getCurrentPreparation(
  supabase: SupabaseClient<Database>,
  _userId: string,
): Promise<PreparationEngineResult> {
  const { data: profileView, error } = await supabase
    .from("vstudent_ucat_study_plan_profiles")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!profileView) throw new Error("Set your UCAT goal first.");
  const profile = profileView as ProfileRow;
  const { data: student, error: studentError } = await supabase
    .from("vstudent_ucat_my_activity_start")
    .select("timezone")
    .maybeSingle();
  if (studentError) throw studentError;

  const [{ planningDate }, inputs] = await Promise.all([
    planningDateFor(profile),
    loadGenerationInputs(supabase, profile.student_id, profile.test_year),
  ]);
  const now = new Date();
  const today = todayIso(now, student?.timezone || "Australia/Adelaide");
  const generatedPreparation = await runCanonicalPreparation({
    supabase,
    studentId: profile.student_id,
    profile: profileInput(profile),
    planningDate,
    inputs,
    today,
    now: now.toISOString(),
    seed: `current-preparation:${profile.student_id}:${today}`,
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
    profile.student_id,
    profile.test_year,
    preparation,
  );
  await persistPreparationSnapshot(profile.student_id, today, preparation);
  return preparation;
}

async function linkCompanionReview(
  tasks: TaskRow[],
  sourceTask: TaskRow,
  activity: {
    id: string;
    type: "practice_session" | "set_attempt" | "mock_attempt";
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
      ? `/progress/mocks/mock-attempts/${activity.id}`
      : activity.type === "set_attempt"
        ? `/progress/set-attempts/${activity.id}`
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
        sourceTask.matched_activity_type === "set_attempt" ||
        sourceTask.matched_activity_type === "mock_attempt")
    ) {
      await linkCompanionReview(tasks, sourceTask, {
        id: sourceTask.matched_activity_id,
        type: sourceTask.matched_activity_type,
        questionCount:
          sourceTask.matched_activity_type !== "mock_attempt"
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
  const [learningRes, practiceRes, setRes, mockRes, trainerRes] =
    await Promise.all([
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
        .from("student_question_set_attempts")
        .select("id, question_set_id, attempted_at, completed_at, total_points")
        .eq("student_id", studentId)
        .is("student_ucat_mock_attempt_id", null)
        .gte("attempted_at", evidenceSince)
        .order("attempted_at"),
      admin
        .from("student_ucat_mock_attempts")
        .select("id, ucat_mock_id, attempted_at, completed_at")
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
  for (const result of [
    learningRes,
    practiceRes,
    setRes,
    mockRes,
    trainerRes,
  ]) {
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
      type: "practice_session" | "set_attempt" | "mock_attempt";
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
    } else if (task.task_type === "section_benchmark" && task.question_set_id) {
      const attempt = setRes.data?.find(
        (item) =>
          item.question_set_id === task.question_set_id &&
          !usedActivities.has(item.id) &&
          item.completed_at,
      );
      if (attempt?.completed_at) {
        usedActivities.add(attempt.id);
        update = {
          status: "completed",
          completed_at: attempt.completed_at,
          completed_units: task.target_units ?? attempt.total_points ?? 1,
          matched_activity_type: "set_attempt",
          matched_activity_id: attempt.id,
        };
        reviewActivity = {
          id: attempt.id,
          type: "set_attempt",
          questionCount: task.target_units,
        };
      }
    } else if (task.task_type === "practice" && task.section_id) {
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
            questionStemCategoryId: task.question_stem_category_id,
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
        (item) =>
          (!task.mock_id || item.ucat_mock_id === task.mock_id) &&
          !usedActivities.has(item.id) &&
          item.completed_at,
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
    availableStudyDaysPerWeek: 0,
    recommendedStudyDaysPerWeek: 0,
    outstandingSectionEquivalents: 0,
    schedulableSectionEquivalents: 0,
    message: null,
  };
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fallback;
  const record = value as Record<string, Json | undefined>;
  const message = typeof record.message === "string" ? record.message : null;
  if (isLegacyDemandCapacityRiskMessage(message)) return fallback;
  return {
    level: record.level === "warning" ? "warning" : "none",
    availableStudyDaysPerWeek:
      typeof record.availableStudyDaysPerWeek === "number"
        ? record.availableStudyDaysPerWeek
        : 0,
    recommendedStudyDaysPerWeek:
      typeof record.recommendedStudyDaysPerWeek === "number"
        ? record.recommendedStudyDaysPerWeek
        : 0,
    outstandingSectionEquivalents:
      typeof record.outstandingSectionEquivalents === "number"
        ? record.outstandingSectionEquivalents
        : 0,
    schedulableSectionEquivalents:
      typeof record.schedulableSectionEquivalents === "number"
        ? record.schedulableSectionEquivalents
        : 0,
    message,
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

function readReadinessSnapshot(value: Json): StudyPlanReadinessSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const readiness = (value as Record<string, Json | undefined>).readiness;
  if (!readiness || typeof readiness !== "object" || Array.isArray(readiness)) {
    return null;
  }
  const record = readiness as Record<string, Json | undefined>;
  if (
    (record.mode !== "learning" &&
      record.mode !== "timing" &&
      record.mode !== "exam") ||
    typeof record.examDateOverride !== "boolean" ||
    typeof record.daysUntilExam !== "number" ||
    !Array.isArray(record.sections)
  ) {
    return null;
  }
  return readiness as unknown as StudyPlanReadinessSnapshot;
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
): Promise<
  BuildNextStepsInput & {
    timingSessions: StudyPlanTimingEvidenceSession[];
    scoreEvidence: RepresentativeScoreEvidence[];
    benchmarkSets: BenchmarkSetAsset[];
    benchmarkMocks: BenchmarkMockAsset[];
    lastLearningModuleServedAtBySection: Record<string, string>;
  }
> {
  const admin = requireAdmin();
  const [inputs, trainerAttempts, planning] = await Promise.all([
    loadGenerationInputs(supabase, studentId, profile.test_year),
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
    targetScore: profile.target_score,
    sjtPreference: normalizeSjtPreference(profile.sjt_preference),
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
  const currentSnapshotExists = await hasPreparationSnapshot(
    supabase,
    today,
    CURRENT_PREPARATION_VERSIONS,
  );
  if (
    current.length >= 2 &&
    triggerKey === currentTrigger &&
    currentSnapshotExists
  ) {
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
  const nextTrigger = triggerKey ?? `daily:${today}`;
  const now = new Date();
  const forecast = await loadForecastEvidence(
    supabase,
    studentId,
    today,
    buildInput.timingSessions,
    buildInput.sections,
  );
  const preparation = prepareStudent({
    clock: { now: now.toISOString(), today },
    seed: `guidance:${studentId}:${nextTrigger}`,
    versions: CURRENT_PREPARATION_VERSIONS,
    timingProfile: STANDARD_PREPARATION_TIMING_PROFILE,
    goal: {
      planningDate: buildInput.planningDate,
      profile: profileInput(profile),
    },
    content: {
      sections: buildInput.sections,
      categories: buildInput.categories,
      learningModules: buildInput.learningModules,
      skillTrainers: buildInput.skillTrainers,
      tagSignals: buildInput.tagSignals,
      benchmarkSets: buildInput.benchmarkSets,
      benchmarkMocks: buildInput.benchmarkMocks,
    },
    evidence: {
      sectionSignals: buildInput.signals,
      timingSessions: buildInput.timingSessions,
      scoreEvidence: buildInput.scoreEvidence,
      completedMockCount: buildInput.completedMockCount,
      lastLearningModuleServedAtBySection:
        buildInput.lastLearningModuleServedAtBySection,
      forecast,
    },
    guidance: {
      dailyWarmup: buildInput.dailyWarmup,
      incompleteReview: buildInput.incompleteReview,
      trainerAttemptCounts: Object.fromEntries(buildInput.trainerAttemptCounts),
    },
  });
  await persistPreparationProgression(
    studentId,
    profile.test_year,
    preparation,
  );
  await persistPreparationSnapshot(studentId, today, preparation);
  const drafts = preparation.immediateGuidance;
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
  const now = new Date();
  const preparation = await runCanonicalPreparation({
    supabase,
    studentId: student.id,
    profile: profileInput(profileResult.data),
    planningDate: buildInput.planningDate,
    inputs: buildInput,
    today,
    now: now.toISOString(),
    seed: `alternative:${student.id}:${today}:${input.excludedKeys.join("|")}`,
    guidance: {
      dailyWarmup: false,
      incompleteReview: describedIncompleteReview,
      trainerAttemptCounts: Object.fromEntries(buildInput.trainerAttemptCounts),
    },
  });
  const draft = buildAlternativeNextStep(
    {
      ...buildInput,
      activityCandidates: preparation.activityCandidates,
      readiness: preparation.assessment,
    },
    input,
  );
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
  const { data: existingProfile, error: existingProfileError } = await admin
    .from("ucat_student_study_plan_profiles")
    .select("study_plan_enabled")
    .eq("student_id", studentId)
    .maybeSingle();
  if (existingProfileError) throw existingProfileError;
  const { data: profile, error } = await admin
    .from("ucat_student_study_plan_profiles")
    .upsert(
      {
        student_id: studentId,
        study_plan_enabled: input.studyPlanEnabled,
        target_score: input.targetScore,
        test_year: input.testYear,
        test_date: input.testDate,
        available_days: input.availableDays as unknown as Json,
        preferred_mock_weekday: input.preferredMockWeekday,
        sjt_preference: normalizeSjtPreference(input.sjtPreference),
        setup_completed_at: new Date().toISOString(),
      },
      { onConflict: "student_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  const transition = planProfileTransition({
    wasEnabled: existingProfile?.study_plan_enabled ?? false,
    willBeEnabled: input.studyPlanEnabled,
  });
  if (transition.clearGuidance) {
    const { error: clearStepsError } = await admin
      .from("ucat_student_next_steps")
      .delete()
      .eq("student_id", studentId);
    if (clearStepsError) throw clearStepsError;
  }
  if (transition.generateFreshPlan) {
    await generateForProfile(
      supabase,
      studentId,
      profile,
      profile.last_generated_at ? "profile_changed" : "onboarding",
    );
  } else if (transition.retireFuturePlan) {
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
  const generationInputs = await loadGenerationInputs(
    supabase,
    studentId,
    currentPlan.profile.testYear,
  );
  const now = new Date();
  const preparation = await runCanonicalPreparation({
    supabase,
    studentId,
    profile: currentPlan.profile,
    planningDate: currentPlan.profile.planningDate,
    inputs: generationInputs,
    today: currentPlan.today,
    now: now.toISOString(),
    seed: `extra-study:${studentId}:${currentPlan.today}:${input.minutes}:${input.sectionKey ?? "any"}`,
  });
  const nextSortOrder =
    Math.max(-1, ...currentPlan.todayTasks.map((task) => task.sortOrder)) + 1;
  const extraActivityCandidates = preparation.activityCandidates;
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
        activityCandidates: extraActivityCandidates,
        readiness: preparation.assessment,
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
  const preparationVersionChanged = generation
    ? needsPreparationVersionReplacement(
        generation.input_snapshot,
        CURRENT_PREPARATION_VERSIONS,
      )
    : false;
  let missedWorkSinceGeneration = false;
  if (generation && options.allowAutomaticReplan !== false) {
    const { count, error } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("id", { count: "exact", head: true })
      .eq("generation_id", generation.id)
      .lt("scheduled_date", today)
      .in("status", ["planned", "partial"]);
    if (error) throw error;
    missedWorkSinceGeneration = (count ?? 0) > 0;
  }
  if (
    profile.study_plan_enabled &&
    options.allowAutomaticReplan !== false &&
    (!generation ||
      mockCompletedSinceGeneration ||
      preparationVersionChanged ||
      missedWorkSinceGeneration ||
      !profile.next_weekly_replan_on ||
      profile.next_weekly_replan_on <= today)
  ) {
    await generateForProfile(
      supabase,
      studentId,
      profile,
      !generation
        ? "onboarding"
        : preparationVersionChanged || missedWorkSinceGeneration
          ? "significant_activity"
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
      sjtPreference: normalizeSjtPreference(profile.sjt_preference),
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
          readiness: readReadinessSnapshot(generation.projection_snapshot),
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
  supabase: SupabaseClient<Database>,
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

  if (action === "skip") {
    const { data: profile, error: profileError } = await admin
      .from("ucat_student_study_plan_profiles")
      .select("*")
      .eq("student_id", studentId)
      .eq("study_plan_enabled", true)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile) {
      await generateForProfile(
        supabase,
        studentId,
        profile,
        "significant_activity",
      );
    }
  }
}

/** Mark the linked Study plan review task complete when attempt review finishes. */
export async function completeStudyPlanReviewForAttempt(
  userId: string,
  attemptType: "practice_session" | "set_attempt" | "mock_attempt",
  attemptId: string,
): Promise<void> {
  const admin = requireAdmin();
  const studentId = await resolveStudentId(userId);
  const now = new Date().toISOString();
  const matchedActivityType =
    attemptType === "practice_session"
      ? "practice_session"
      : attemptType === "mock_attempt"
        ? "mock_attempt"
        : null;

  const { data: tasks, error } = await admin
    .from("ucat_student_study_plan_tasks")
    .select(
      "id, matched_activity_id, matched_activity_type, launch_path, status",
    )
    .eq("student_id", studentId)
    .eq("task_type", "review")
    .in("status", ["planned", "in_progress", "partial"]);
  if (error) throw error;
  if (!tasks?.length) return;

  const match = tasks.find((task) => {
    if (
      matchedActivityType &&
      task.matched_activity_type === matchedActivityType &&
      task.matched_activity_id === attemptId
    ) {
      return true;
    }
    if (task.matched_activity_id === attemptId) return true;
    const path = task.launch_path ?? "";
    return (
      path.endsWith(`/${attemptId}`) ||
      path.includes(`/${attemptId}?`) ||
      path.includes(`/${attemptId}/`)
    );
  });
  if (!match) return;

  const { error: updateError } = await admin
    .from("ucat_student_study_plan_tasks")
    .update({
      status: "completed",
      completed_at: now,
      completed_units: 1,
    })
    .eq("id", match.id)
    .eq("student_id", studentId);
  if (updateError) throw updateError;
}
