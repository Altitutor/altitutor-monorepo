/** @jest-environment node */

import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CURRENT_PREPARATION_VERSIONS,
  prepareStudent,
} from "@/features/preparation";
import {
  createExtraStudyTask,
  getCurrentPreparation,
  getStudyPlan,
  saveStudyPlanProfile,
  suggestAlternativeStudyGuidance,
  updateStudyPlanTask,
} from "@/features/study-plan/server/study-plan-service";
import { generateExtraStudyTasks } from "@/features/study-plan/lib/generator";
import { buildAlternativeNextStep } from "@/features/study-plan/lib/next-step-guidance";
import { supabaseAdmin } from "@/lib/supabase/admin";

jest.mock("server-only", () => ({}));
jest.mock("@/features/preparation", () => {
  const actual = jest.requireActual("@/features/preparation");
  return { ...actual, prepareStudent: jest.fn() };
});
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: jest.fn(), rpc: jest.fn() },
}));
jest.mock("@/features/study-plan/lib/generator", () => {
  const actual = jest.requireActual("@/features/study-plan/lib/generator");
  return { ...actual, generateExtraStudyTasks: jest.fn() };
});
jest.mock("@/features/study-plan/lib/next-step-guidance", () => {
  const actual = jest.requireActual(
    "@/features/study-plan/lib/next-step-guidance",
  );
  return { ...actual, buildAlternativeNextStep: jest.fn() };
});

type QueryResult = { data: unknown; error: null; count?: number };
type RecordedUpdate = {
  table: string;
  payload: Record<string, unknown>;
  filters: Map<string, unknown>;
};
type RecordedUpsert = {
  table: string;
  payload: unknown;
};
type RecordedInsert = { table: string; payload: unknown };
type QueryChain = {
  select: jest.Mock<QueryChain, []>;
  update: jest.Mock<QueryChain, [Record<string, unknown>]>;
  insert: jest.Mock<QueryChain, [unknown]>;
  upsert: jest.Mock<QueryChain, [unknown]>;
  eq: jest.Mock<QueryChain, [string, unknown]>;
  is: jest.Mock<QueryChain, [string, unknown]>;
  lt: jest.Mock<QueryChain, [string, unknown]>;
  gte: jest.Mock<QueryChain, []>;
  lte: jest.Mock<QueryChain, []>;
  in: jest.Mock<QueryChain, [string, unknown]>;
  not: jest.Mock<QueryChain, []>;
  neq: jest.Mock<QueryChain, []>;
  order: jest.Mock<QueryChain, []>;
  limit: jest.Mock<QueryChain, []>;
  maybeSingle: jest.Mock<Promise<QueryResult>, []>;
  single: jest.Mock<Promise<QueryResult>, []>;
  then: (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

const profile = {
  id: "profile-1",
  student_id: "student-1",
  study_plan_enabled: true,
  target_score: 2400,
  test_year: 2026,
  test_date: "2026-09-01",
  available_days: [{ weekday: 2, maxMinutes: 60 }],
  preferred_mock_weekday: 2,
  setup_completed_at: "2026-08-01T00:00:00.000Z",
  last_generated_at: "2026-08-04T00:00:00.000Z",
  next_weekly_replan_on: "2026-08-18",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
};

const oldGeneration = {
  id: "generation-old",
  student_id: "student-1",
  profile_id: "profile-1",
  reason: "weekly",
  planning_date: "2026-09-01",
  starts_on: "2026-08-04",
  ends_on: "2026-08-25",
  input_snapshot: {
    versions: {
      ...CURRENT_PREPARATION_VERSIONS,
      policy: "evidence-driven-preparation-policy-v2",
    },
    completedMockCount: 0,
  },
  projection_snapshot: {},
  capacity_risk: null,
  generated_at: "2026-08-04T00:00:00.000Z",
  superseded_at: null,
};

const replacementGeneration = {
  ...oldGeneration,
  id: "generation-new",
  reason: "significant_activity",
  input_snapshot: { versions: CURRENT_PREPARATION_VERSIONS },
  generated_at: "2026-08-11T00:00:00.000Z",
};

function createDatabaseHarness(
  options: {
    currentPolicy?: boolean;
    missedWorkCount?: number;
    studyPlanEnabled?: boolean;
    wasEnabled?: boolean;
    recentTimingEvidence?: boolean;
    completedMockCount?: number;
    taskType?: "practice" | "review";
  } = {},
) {
  const updates: RecordedUpdate[] = [];
  const upserts: RecordedUpsert[] = [];
  const inserts: RecordedInsert[] = [];
  let replacementPersisted = false;
  let profileUpserted = false;
  const activeGeneration = options.currentPolicy
    ? {
        ...oldGeneration,
        input_snapshot: { versions: CURRENT_PREPARATION_VERSIONS },
      }
    : oldGeneration;

  function resultFor(
    table: string,
    filters: Map<string, unknown>,
    single: boolean,
  ): QueryResult {
    if (table === "students" && single) {
      return {
        data: { id: "student-1", timezone: "Australia/Adelaide" },
        error: null,
      };
    }
    if (table === "vstudent_ucat_my_activity_start" && single) {
      return {
        data: {
          student_id: "student-1",
          timezone: "Australia/Adelaide",
        },
        error: null,
      };
    }
    if (table === "vstudent_ucat_study_plan_profiles" && single) {
      return { data: profile, error: null };
    }
    if (table === "ucat_student_study_plan_profiles" && single) {
      return {
        data: {
          ...profile,
          study_plan_enabled:
            profileUpserted && options.studyPlanEnabled != null
              ? options.studyPlanEnabled
              : (options.wasEnabled ?? true),
        },
        error: null,
      };
    }
    if (table === "ucat_student_study_plan_generations" && single) {
      return {
        data: replacementPersisted ? replacementGeneration : activeGeneration,
        error: null,
      };
    }
    if (
      table === "ucat_student_study_plan_tasks" &&
      single &&
      filters.has("id")
    ) {
      return {
        data: {
          id: "task-today",
          status: "planned",
          task_type: options.taskType ?? "practice",
          generation_id: "generation-old",
          scheduled_date: "2026-08-11",
          sort_order: 0,
          started_at: null,
        },
        error: null,
      };
    }
    if (single) return { data: null, error: null };
    if (
      table === "ucat_student_study_plan_tasks" &&
      filters.has("scheduled_date:lt")
    ) {
      return {
        data: null,
        error: null,
        count: options.missedWorkCount ?? 0,
      };
    }
    if (table === "student_ucat_mock_attempts") {
      return {
        data: null,
        error: null,
        count: options.completedMockCount ?? 0,
      };
    }
    if (options.recentTimingEvidence && table === "ucat_sections") {
      return {
        data: [
          {
            id: "section-1",
            name: "Verbal Reasoning",
            section_number: 1,
            number_of_questions: 44,
            time_per_question: 40,
          },
        ],
        error: null,
      };
    }
    if (
      options.recentTimingEvidence &&
      table === "vstudent_ucat_preparation_timing_evidence"
    ) {
      return {
        data: [
          {
            evidence_session_id: "session-1",
            source: "practice",
            section_id: "section-1",
            completed_at: "2026-08-10T01:00:00.000Z",
            prescribed_pace: 1,
            observed_pace: 1,
            accuracy: 0.8,
            section_equivalents: 3,
            category_ids: [],
            breadth: "broad",
          },
        ],
        error: null,
      };
    }
    if (
      options.recentTimingEvidence &&
      table === "ucat_student_study_plan_generations"
    ) {
      return { data: [activeGeneration], error: null };
    }
    return { data: [], error: null };
  }

  function query(table: string) {
    let updatePayload: Record<string, unknown> | null = null;
    const filters = new Map<string, unknown>();
    const chain: QueryChain = {
      select: jest.fn((): QueryChain => chain),
      update: jest.fn((payload: Record<string, unknown>) => {
        updatePayload = payload;
        return chain;
      }),
      insert: jest.fn((payload: unknown) => {
        inserts.push({ table, payload });
        return chain;
      }),
      upsert: jest.fn((payload: unknown) => {
        upserts.push({ table, payload });
        if (table === "ucat_student_study_plan_profiles") {
          profileUpserted = true;
        }
        return chain;
      }),
      eq: jest.fn((column: string, value: unknown) => {
        filters.set(column, value);
        return chain;
      }),
      is: jest.fn((column: string, value: unknown) => {
        filters.set(column, value);
        return chain;
      }),
      lt: jest.fn((column: string, value: unknown) => {
        filters.set(`${column}:lt`, value);
        return chain;
      }),
      gte: jest.fn(() => chain),
      lte: jest.fn(() => chain),
      in: jest.fn((column: string, value: unknown) => {
        filters.set(`${column}:in`, value);
        return chain;
      }),
      not: jest.fn(() => chain),
      neq: jest.fn(() => chain),
      order: jest.fn(() => chain),
      limit: jest.fn(() => chain),
      maybeSingle: jest.fn(async () => resultFor(table, filters, true)),
      single: jest.fn(async () => resultFor(table, filters, true)),
      then: (
        resolve: (value: QueryResult) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => {
        if (updatePayload) {
          updates.push({
            table,
            payload: updatePayload,
            filters: new Map(filters),
          });
        }
        return Promise.resolve(resultFor(table, filters, false)).then(
          resolve,
          reject,
        );
      },
    };
    return chain;
  }

  const admin = supabaseAdmin!;
  jest.mocked(admin.from).mockImplementation((table) => query(table) as never);
  const rpc = admin.rpc as unknown as jest.MockedFunction<
    (name: string, args: unknown) => Promise<QueryResult>
  >;
  rpc.mockImplementation(async () => {
    replacementPersisted = true;
    return { data: "generation-new", error: null };
  });

  const studentClient = {
    from: jest.fn((table: string) => query(table)),
  } as unknown as SupabaseClient<Database>;

  return { admin, studentClient, updates, upserts, inserts };
}

function mockReplacementPlan() {
  const activityCandidates = [
    {
      id: "canonical-practice-vr",
      kind: "practice",
      requirement: "optional",
      sectionId: "section-1",
      categoryIds: ["category-1"],
      questionTagIds: [],
      learningModuleId: null,
      skillTrainerId: null,
      sourceAttemptId: null,
      scope: "category",
      dose: { questionCount: 10, sectionEquivalents: 0.25 },
      duration: { practiceMinutes: 15, reviewMinutes: 5 },
      objective: "reliable_weakness",
      reasonCode: "preparation.practice.reliable_weakness",
      studentReason: "Reliable evidence shows this is useful next.",
      ranking: {
        milestone: 1,
        weakness: 2,
        uncertainty: 0,
        targetGap: 0,
        tagSampling: 0,
        total: 3,
      },
    },
  ];
  jest.mocked(prepareStudent).mockReturnValue({
    generatedAt: "2026-08-11T00:00:00.000Z",
    seed: "replacement-seed",
    versions: CURRENT_PREPARATION_VERSIONS,
    timingProfile: {},
    progressionEvents: [],
    assessment: { sections: [] },
    currentScore: {
      status: "unavailable",
      currentEstimate: null,
      confidence: null,
      uncertainty: null,
      sections: [],
    },
    trajectory: { status: "unavailable", history: [], points: [] },
    immediateGuidance: [],
    activityCandidates,
    explanationTrace: [],
    plan: {
      tasks: [
        {
          scheduledDate: "2026-08-12",
          sortOrder: 0,
          taskType: "practice",
          title: "Regenerated future work",
          description: "Practice",
          rationale: "Respond to current evidence",
          estimatedMinutes: 20,
          targetUnits: 10,
          sectionId: null,
          questionStemCategoryId: null,
          questionTagId: null,
          learningModuleId: null,
          questionSetId: null,
          mockId: null,
          skillTrainerId: null,
          launchPath: "/practice",
          launchConfig: {},
        },
      ],
      endsOn: "2026-09-01",
      capacityRisk: {
        level: "none",
        availableMinutesPerWeek: 60,
        recommendedMinutesPerWeek: 60,
        outstandingSectionEquivalents: 1,
        schedulableSectionEquivalents: 2,
        message: null,
      },
      sectionTargets: [],
      readiness: { mode: "learning", sections: [] },
    },
  } as never);
}

describe("Study plan persistence orchestration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-08-11T01:00:00.000Z"));
    mockReplacementPlan();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("regenerates future work through the replacement RPC after today's task is skipped", async () => {
    const { admin, studentClient, updates } = createDatabaseHarness();

    await updateStudyPlanTask(
      studentClient,
      "user-1",
      "task-today",
      "skip",
    );

    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "ucat_student_study_plan_tasks",
          payload: expect.objectContaining({ status: "skipped" }),
        }),
      ]),
    );
    expect(
      updates.some(
        (update) =>
          update.filters.get("generation_id") === "generation-old" &&
          update.filters.get("scheduled_date:lt") === "2026-08-11" &&
          update.payload.status === "skipped",
      ),
    ).toBe(true);
    expect(admin.rpc).toHaveBeenCalledWith(
      "replace_ucat_study_plan_generation",
      expect.objectContaining({
        p_reason: "significant_activity",
        p_preserve_through: "2026-08-11",
        p_tasks: [
          expect.objectContaining({
            scheduled_date: "2026-08-12",
            title: "Regenerated future work",
          }),
        ],
      }),
    );
  });

  it("loads current Preparation identity and plan profile through Student facades", async () => {
    const { admin, studentClient } = createDatabaseHarness();

    await getCurrentPreparation(studentClient, "user-1");

    expect(studentClient.from).toHaveBeenCalledWith(
      "vstudent_ucat_my_activity_start",
    );
    expect(studentClient.from).toHaveBeenCalledWith(
      "vstudent_ucat_study_plan_profiles",
    );
    expect(
      jest
        .mocked(admin.from)
        .mock.calls.some(
          ([table]) =>
            (table as string) === "ucat_student_study_plan_profiles",
        ),
    ).toBe(false);
  });

  it("persists review completion without advancing future work from scheduling", async () => {
    const { admin, studentClient, updates } = createDatabaseHarness({
      taskType: "review",
    });

    await updateStudyPlanTask(
      studentClient,
      "user-1",
      "task-today",
      "complete",
    );

    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "ucat_student_study_plan_tasks",
          payload: expect.objectContaining({
            status: "completed",
            completed_units: 1,
          }),
        }),
      ]),
    );
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("replaces future work after a newly completed mock", async () => {
    const { admin, studentClient } = createDatabaseHarness({
      currentPolicy: true,
      completedMockCount: 1,
    });

    await getStudyPlan(studentClient, "user-1", { reconcileTasks: false });

    expect(prepareStudent).toHaveBeenCalledWith(
      expect.objectContaining({
        evidence: expect.objectContaining({ completedMockCount: 1 }),
      }),
    );
    expect(admin.rpc).toHaveBeenCalledWith(
      "replace_ucat_study_plan_generation",
      expect.objectContaining({ p_reason: "mock_completed" }),
    );
  });

  it("replaces an active generation when its preparation policy version is stale", async () => {
    const { admin, studentClient } = createDatabaseHarness();

    await getStudyPlan(studentClient, "user-1", { reconcileTasks: false });

    expect(admin.rpc).toHaveBeenCalledWith(
      "replace_ucat_study_plan_generation",
      expect.objectContaining({
        p_reason: "significant_activity",
        p_input_snapshot: expect.objectContaining({
          versions: CURRENT_PREPARATION_VERSIONS,
        }),
      }),
    );
  });

  it("regenerates future work when an active generation contains missed work", async () => {
    const { admin, studentClient } = createDatabaseHarness({
      currentPolicy: true,
      missedWorkCount: 1,
    });

    await getStudyPlan(studentClient, "user-1", { reconcileTasks: false });

    expect(admin.rpc).toHaveBeenCalledWith(
      "replace_ucat_study_plan_generation",
      expect.objectContaining({ p_reason: "significant_activity" }),
    );
  });

  it("retires the calendar and persists recent-workload Preparation output when the plan is disabled", async () => {
    const { admin, studentClient, updates, upserts } = createDatabaseHarness({
      studyPlanEnabled: false,
      recentTimingEvidence: true,
    });

    await saveStudyPlanProfile(studentClient, "user-1", {
      studyPlanEnabled: false,
      targetScore: 2400,
      testYear: 2026,
      testDate: "2026-09-01",
      availableDays: [{ weekday: 2, maxMinutes: 60 }],
      preferredMockWeekday: 2,
      sjtPreference: "a_little",
    });

    expect(prepareStudent).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: expect.objectContaining({
          profile: expect.objectContaining({ studyPlanEnabled: false }),
        }),
        evidence: expect.objectContaining({
          forecast: expect.objectContaining({
            recentCoreSectionEquivalentsPerWeek: 1,
          }),
        }),
      }),
    );
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "ucat_student_study_plan_generations",
          payload: expect.objectContaining({
            superseded_at: expect.any(String),
          }),
        }),
      ]),
    );
    expect(upserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "ucat_preparation_snapshots",
          payload: expect.objectContaining({
            student_id: "student-1",
            snapshot_date: "2026-08-11",
            trajectory_model_version:
              CURRENT_PREPARATION_VERSIONS.trajectoryModel,
          }),
        }),
      ]),
    );
    expect(admin.rpc).not.toHaveBeenCalledWith(
      "replace_ucat_study_plan_generation",
      expect.objectContaining({
        p_reason: "profile_changed",
      }),
    );
  });

  it("refreshes the Preparation snapshot for a Student who already has the plan disabled", async () => {
    const { admin, studentClient, upserts } = createDatabaseHarness({
      wasEnabled: false,
      studyPlanEnabled: false,
      recentTimingEvidence: true,
    });

    await saveStudyPlanProfile(studentClient, "user-1", {
      studyPlanEnabled: false,
      targetScore: 2400,
      testYear: 2026,
      testDate: "2026-09-01",
      availableDays: [{ weekday: 2, maxMinutes: 60 }],
      preferredMockWeekday: 2,
      sjtPreference: "a_little",
    });

    expect(prepareStudent).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: expect.objectContaining({
          profile: expect.objectContaining({ studyPlanEnabled: false }),
        }),
        evidence: expect.objectContaining({
          forecast: expect.objectContaining({
            recentCoreSectionEquivalentsPerWeek: 1,
          }),
        }),
      }),
    );
    expect(
      upserts.some(
        (upsert) => upsert.table === "ucat_preparation_snapshots",
      ),
    ).toBe(true);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("wires canonical Preparation candidates into alternative guidance", async () => {
    const { studentClient } = createDatabaseHarness();
    jest.mocked(buildAlternativeNextStep).mockReturnValue({
      taskType: "practice",
      title: "Canonical alternative",
      description: "Practice a useful section.",
      rationale: "Reliable evidence shows this is useful next.",
      estimatedMinutes: 20,
      sectionId: "section-1",
      questionStemCategoryId: "category-1",
      learningModuleId: null,
      questionSetId: null,
      mockId: null,
      skillTrainerId: null,
      launchPath: "/practice",
      launchConfig: { optional: true },
      sourceAttemptType: null,
      sourceAttemptId: null,
    });

    const alternative = await suggestAlternativeStudyGuidance(
      studentClient,
      "user-1",
      { excludedKeys: [], currentTaskTypes: [] },
    );

    const candidates = jest.mocked(prepareStudent).mock.results.at(-1)?.value
      .activityCandidates;
    expect(buildAlternativeNextStep).toHaveBeenCalledWith(
      expect.objectContaining({
        activityCandidates: candidates,
        readiness: expect.objectContaining({ sections: [] }),
      }),
      { excludedKeys: [], currentTaskTypes: [] },
    );
    expect(alternative).toMatchObject({
      title: "Canonical alternative",
      launchConfig: { optional: true },
    });
  });

  it("wires canonical Preparation candidates into Give me more and persists the task", async () => {
    const { studentClient, inserts } = createDatabaseHarness({
      currentPolicy: true,
    });
    jest.mocked(generateExtraStudyTasks).mockReturnValue([
      {
        scheduledDate: "2026-08-11",
        sortOrder: 0,
        taskType: "practice",
        title: "Canonical extra practice",
        description: "Optional extension.",
        rationale: "Reliable evidence shows this is useful next.",
        estimatedMinutes: 20,
        targetUnits: 10,
        sectionId: "section-1",
        questionStemCategoryId: "category-1",
        questionTagId: null,
        learningModuleId: null,
        questionSetId: null,
        mockId: null,
        skillTrainerId: null,
        launchPath: "/practice",
        launchConfig: { optional: true },
      },
    ]);

    await createExtraStudyTask(studentClient, "user-1", {
      minutes: 30,
      sectionKey: null,
    });

    const candidates = jest.mocked(prepareStudent).mock.results.at(-1)?.value
      .activityCandidates;
    expect(generateExtraStudyTasks).toHaveBeenCalledWith(
      expect.objectContaining({
        activityCandidates: candidates,
        readiness: expect.objectContaining({ sections: [] }),
      }),
    );
    expect(inserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "ucat_student_study_plan_tasks",
          payload: expect.arrayContaining([
            expect.objectContaining({ title: "Canonical extra practice" }),
          ]),
        }),
      ]),
    );
  });
});
