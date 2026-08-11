/** @jest-environment node */

import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CURRENT_PREPARATION_VERSIONS,
  prepareStudent,
} from "@/features/preparation";
import {
  getStudyPlan,
  updateStudyPlanTask,
} from "@/features/study-plan/server/study-plan-service";
import { supabaseAdmin } from "@/lib/supabase/admin";

jest.mock("server-only", () => ({}));
jest.mock("@/features/preparation", () => {
  const actual = jest.requireActual("@/features/preparation");
  return { ...actual, prepareStudent: jest.fn() };
});
jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: jest.fn(), rpc: jest.fn() },
}));

type QueryResult = { data: unknown; error: null; count?: number };
type RecordedUpdate = {
  table: string;
  payload: Record<string, unknown>;
  filters: Map<string, unknown>;
};
type QueryChain = {
  select: jest.Mock<QueryChain, []>;
  update: jest.Mock<QueryChain, [Record<string, unknown>]>;
  insert: jest.Mock<QueryChain, []>;
  upsert: jest.Mock<QueryChain, []>;
  eq: jest.Mock<QueryChain, [string, unknown]>;
  is: jest.Mock<QueryChain, [string, unknown]>;
  lt: jest.Mock<QueryChain, [string, unknown]>;
  gte: jest.Mock<QueryChain, []>;
  in: jest.Mock<QueryChain, [string, unknown]>;
  not: jest.Mock<QueryChain, []>;
  neq: jest.Mock<QueryChain, []>;
  order: jest.Mock<QueryChain, []>;
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
  options: { currentPolicy?: boolean; missedWorkCount?: number } = {},
) {
  const updates: RecordedUpdate[] = [];
  let replacementPersisted = false;
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
    if (table === "ucat_student_study_plan_profiles" && single) {
      return { data: profile, error: null };
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
          task_type: "practice",
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
      return { data: null, error: null, count: 0 };
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
      insert: jest.fn(() => chain),
      upsert: jest.fn(() => chain),
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
      in: jest.fn((column: string, value: unknown) => {
        filters.set(`${column}:in`, value);
        return chain;
      }),
      not: jest.fn(() => chain),
      neq: jest.fn(() => chain),
      order: jest.fn(() => chain),
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

  return { admin, studentClient, updates };
}

function mockReplacementPlan() {
  jest.mocked(prepareStudent).mockReturnValue({
    generatedAt: "2026-08-11T00:00:00.000Z",
    seed: "replacement-seed",
    versions: CURRENT_PREPARATION_VERSIONS,
    timingProfile: {},
    progressionEvents: [],
    assessment: { sections: [] },
    currentScore: { sections: [] },
    trajectory: {},
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
});
