/** @jest-environment node */
// Run only through the owned runtime: pnpm dev:isolated exec -- pnpm --filter
// ucat-web exec jest --runInBand --testMatch '**/generation-replacement.integration.ts'
import { execFileSync } from "node:child_process";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { replaceStudyPlanGeneration } from "../generation-replacement";
import { PREPARATION_SANDBOX_PERSONAS } from "@/features/preparation/testing/sandbox";
import { prepareStudent } from "@/features/preparation/lib/engine";

jest.mock("server-only", () => ({}));

const url = process.env.SUPABASE_URL;
// Verify exact checkout/manifest/container/API identity and the outer execution
// lease before creating a client, including on manually targeted Jest runs.
execFileSync(
  "python3",
  [
    path.resolve(
      __dirname,
      "../../../../../../../scripts/verify-study-plan-test-target.py",
    ),
    url ?? "",
  ],
  { stdio: "pipe" },
);
const admin = createClient<Database>(
  url!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

describe("Study Plan generation replacement against owned Postgres", () => {
  let profile: Database["public"]["Tables"]["ucat_student_study_plan_profiles"]["Row"];
  const input = structuredClone(
    PREPARATION_SANDBOX_PERSONAS["general-orientation"].input,
  );

  const students: string[] = [];
  beforeEach(async () => {
    const studentId = randomUUID();
    students.push(studentId);
    const student = await admin.from("students").insert({
      id: studentId,
      first_name: "Generation",
      last_name: "Contract",
      timezone: "Australia/Adelaide",
    });
    if (student.error) throw student.error;
    const result = await admin
      .from("ucat_student_study_plan_profiles")
      .insert({
        student_id: studentId,
        study_plan_enabled: true,
        test_year: 2026,
        test_date: "2026-08-05",
        target_score: 2200,
        available_days: [{ weekday: 1 }, { weekday: 3 }, { weekday: 6 }],
        preferred_mock_weekday: 6,
      })
      .select("*")
      .single();
    if (result.error) throw result.error;
    profile = result.data;
    const sections = await admin
      .from("ucat_sections")
      .select("id, section_number");
    if (sections.error) throw sections.error;
    const ids = new Map(sections.data.map((s) => [s.section_number, s.id]));
    input.content.sections.forEach((s) => {
      s.id = ids.get(s.sectionNumber)!;
    });
    input.evidence.sectionSignals.forEach((s, i) => {
      s.sectionId = input.content.sections[i]!.id;
    });
    input.content.categories = [];
    const modules = await admin
      .from("ucat_learning_modules")
      .select("id")
      .eq("kind", "lesson")
      .limit(5);
    if (modules.error) throw modules.error;
    expect(modules.data).toHaveLength(5);
    input.content.learningModules = PREPARATION_SANDBOX_PERSONAS[
      "general-orientation"
    ].input.content.learningModules
      .filter((m) => m.sectionId === null)
      .map((m, i) => ({
        ...m,
        id: modules.data![i]!.id,
        journeyPlacement: "orientation",
      }));
    input.content.skillTrainers = [];
    input.content.benchmarkSets = [];
    input.content.benchmarkMocks = [];
  });

  afterAll(async () => {
    for (const studentId of students) {
      for (const table of [
        "ucat_student_study_plan_generations",
        "ucat_student_study_plan_profiles",
      ] as const) {
        const result = await admin
          .from(table)
          .delete()
          .eq("student_id", studentId);
        if (result.error) throw result.error;
      }
      // Student DELETE is intentionally unavailable to service_role. These
      // unlinked fixture Students disappear when the owned stack is disposed.
    }
  });

  async function active() {
    const result = await admin
      .from("ucat_student_study_plan_generations")
      .select("*")
      .eq("student_id", profile.student_id)
      .is("superseded_at", null)
      .single();
    if (result.error) throw result.error;
    return result.data;
  }
  async function tasks(generationId: string) {
    const result = await admin
      .from("ucat_student_study_plan_tasks")
      .select("*")
      .eq("generation_id", generationId);
    if (result.error) throw result.error;
    return result.data;
  }

  let taskSequence = 0;
  async function replace(
    reason: "onboarding" | "weekly" = "onboarding",
    refreshRequestVersion?: number,
    fault?: "prepare" | "progression" | "rollover" | "replacement",
  ) {
    const database =
      fault && fault !== "prepare"
        ? createClient<Database>(url!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: {
              fetch: async (request, init) => {
                const path = new URL(String(request)).pathname;
                const fails =
                  fault === "replacement"
                    ? path.includes("/rpc/replace_ucat_study_plan_generation")
                    : fault === "rollover"
                      ? path.endsWith("/ucat_student_study_plan_tasks") &&
                        init?.method === "PATCH"
                      : path.endsWith(
                          "/ucat_student_preparation_section_states",
                        ) && init?.method === "POST";
                return fails
                  ? new Response(
                      JSON.stringify({ message: `fixture ${fault} failure` }),
                      {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                      },
                    )
                  : fetch(request, init);
              },
            },
          })
        : admin;
    await replaceStudyPlanGeneration(
      { studentId: profile.student_id, profile, reason, refreshRequestVersion },
      {
        admin: database,
        now: () => new Date("2026-01-05T00:00:00.000Z"),
        createId: () =>
          `39800000-0000-4000-8000-${String(++taskSequence).padStart(12, "0")}`,
        loadInputs: async () => ({
          completedMockCount: 0,
          signals: input.evidence.sectionSignals,
        }),
        prepare: async (context) => {
          if (fault === "prepare") throw new Error("fixture prepare failure");
          const result = prepareStudent({
            ...input,
            clock: { today: context.today, now: context.now },
            goal: {
              ...input.goal,
              profile: context.profile,
              planningDate: context.planningDate,
              preservePlanThrough: context.preserveThrough,
              preservedGeneralLessonIds: context.preservedGeneralLessonIds,
            },
          });
          if (fault === "progression")
            result.progressionEvents.push({
              type: "learning_graduated",
              sectionId: input.content.sections[0]!.id,
              route: "accuracy",
              occurredAt: context.now,
              policyVersion: result.versions.policy,
            });
          return result;
        },
      },
    );
  }

  it("creates a complete active generation with linked future reviews", async () => {
    await replace();
    const generations = await admin
      .from("ucat_student_study_plan_generations")
      .select("*")
      .eq("student_id", profile.student_id)
      .is("superseded_at", null);
    expect(generations.error).toBeNull();
    expect(generations.data).toHaveLength(1);
    const tasks = await admin
      .from("ucat_student_study_plan_tasks")
      .select("*")
      .eq("generation_id", generations.data![0]!.id);
    expect(tasks.error).toBeNull();
    expect(tasks.data!.length).toBeGreaterThan(0);
    const reviews = tasks.data!.filter((t) => t.task_type === "review");
    expect(reviews.length).toBeGreaterThan(0);
    for (const review of reviews)
      expect(tasks.data!.some((t) => t.id === review.source_task_id)).toBe(
        true,
      );
    expect(generations.data![0]!.input_snapshot).toMatchObject({
      testDate: "2026-08-05",
      completedMockCount: 0,
    });
  });
  it("retains current General lessons and reviews while re-prescribing missed work", async () => {
    await replace();
    const old = await active();
    const cleared = await admin
      .from("ucat_student_study_plan_tasks")
      .delete()
      .eq("generation_id", old.id);
    if (cleared.error) throw cleared.error;
    const ids = Array.from({ length: 6 }, () => randomUUID());
    const moduleIds = input.content.learningModules.map((m) => m.id);
    const rows = [
      {
        id: ids[0],
        scheduled_date: "2026-01-05",
        status: "planned",
        learning_module_id: moduleIds[1],
      },
      {
        id: ids[1],
        scheduled_date: "2026-01-05",
        status: "partial",
        learning_module_id: moduleIds[2],
      },
      {
        id: ids[2],
        scheduled_date: "2026-01-04",
        status: "in_progress",
        learning_module_id: moduleIds[3],
        started_at: "2026-01-04T00:00:00Z",
      },
      {
        id: ids[3],
        scheduled_date: "2026-01-04",
        status: "planned",
        learning_module_id: moduleIds[0],
      },
      {
        id: ids[4],
        scheduled_date: "2026-01-06",
        status: "planned",
        task_type: "review",
        source_task_id: ids[0],
      },
    ].map((row, i) => ({
      student_id: profile.student_id,
      generation_id: old.id,
      title: "Preservation contract",
      task_type: "learn",
      estimated_minutes: 10,
      target_units: 1,
      sort_order: 100 + i,
      ...row,
    }));
    const inserted = await admin
      .from("ucat_student_study_plan_tasks")
      .insert(rows);
    if (inserted.error) throw inserted.error;
    await replace("weekly");
    const current = await active();
    expect(current.id).not.toBe(old.id);
    const currentTasks = await tasks(current.id);
    expect(currentTasks.find((t) => t.id === ids[0])?.status).toBe("planned");
    expect(currentTasks.find((t) => t.id === ids[1])?.status).toBe("partial");
    expect(currentTasks.find((t) => t.id === ids[2])?.status).toBe(
      "in_progress",
    );
    expect(currentTasks.find((t) => t.id === ids[3])?.status).toBe("skipped");
    expect(currentTasks.find((t) => t.id === ids[4])?.source_task_id).toBe(
      ids[0],
    );
    const futureLessons = currentTasks.filter(
      (t) => t.task_type === "learn" && t.scheduled_date > "2026-01-05",
    );
    expect(
      futureLessons.some((t) => t.learning_module_id === moduleIds[0]),
    ).toBe(true);
    expect(
      futureLessons.some((t) =>
        moduleIds.slice(1, 4).includes(t.learning_module_id!),
      ),
    ).toBe(false);
  });

  async function missedTask() {
    const generation = await active();
    const id = randomUUID();
    const result = await admin.from("ucat_student_study_plan_tasks").insert({
      id,
      student_id: profile.student_id,
      generation_id: generation.id,
      scheduled_date: "2026-01-04",
      sort_order: 300,
      task_type: "practice",
      title: "Missed work",
      estimated_minutes: 10,
      target_units: 10,
    });
    if (result.error) throw result.error;
    return { generation, id };
  }

  it.each(["prepare", "progression", "rollover"] as const)(
    "leaves replacement uncommitted after a %s failure",
    async (fault) => {
      await replace();
      const old = await missedTask();
      await expect(replace("weekly", undefined, fault)).rejects.toMatchObject({
        message: `fixture ${fault} failure`,
      });
      expect((await active()).id).toBe(old.generation.id);
      expect(
        (await tasks(old.generation.id)).find((t) => t.id === old.id)?.status,
      ).toBe("planned");
    },
  );

  it("keeps pre-replacement rollover writes when replacement fails, then permits retry", async () => {
    await replace();
    const old = await missedTask();
    await expect(
      replace("weekly", undefined, "replacement"),
    ).rejects.toMatchObject({ message: "fixture replacement failure" });
    expect((await active()).id).toBe(old.generation.id);
    expect(
      (await tasks(old.generation.id)).find((t) => t.id === old.id),
    ).toMatchObject({ status: "skipped", skipped_reason: "rollover" });
    await replace("weekly");
    expect((await active()).id).not.toBe(old.generation.id);
  });

  it("replays a refresh version without a second generation and retains genuine historical evidence", async () => {
    await replace();
    const old = await active();
    const draftId = randomUUID();
    const startedId = randomUUID();
    const result = await admin.from("ucat_student_study_plan_tasks").insert(
      [
        { id: draftId, status: "planned", started_at: null },
        {
          id: startedId,
          status: "in_progress",
          started_at: "2026-01-05T00:00:00Z",
        },
      ].map((t, i) => ({
        ...t,
        student_id: profile.student_id,
        generation_id: old.id,
        scheduled_date: "2026-01-12",
        sort_order: 200 + i,
        task_type: "practice",
        title: "Refresh history",
        estimated_minutes: 10,
        target_units: 10,
      })),
    );
    if (result.error) throw result.error;
    await replace("weekly", 398);
    const first = await active();
    await replace("weekly", 398);
    expect((await active()).id).toBe(first.id);
    const history = await tasks(old.id);
    expect(history.some((t) => t.id === draftId)).toBe(false);
    expect(history.find((t) => t.id === startedId)?.status).toBe("in_progress");
    const generations = await admin
      .from("ucat_student_study_plan_generations")
      .select("id")
      .eq("student_id", profile.student_id);
    expect(generations.error).toBeNull();
    expect(generations.data).toHaveLength(2);
  });

  it("does not reserve General lessons from a superseded generation", async () => {
    await replace();
    const old = await active();
    const superseded = await admin
      .from("ucat_student_study_plan_generations")
      .update({ superseded_at: "2026-01-05T00:00:00Z" })
      .eq("id", old.id);
    if (superseded.error) throw superseded.error;
    await replace("weekly");
    const current = await active();
    expect(
      (await tasks(current.id)).some(
        (t) =>
          t.task_type === "learn" &&
          t.learning_module_id === input.content.learningModules[0]!.id &&
          t.scheduled_date > "2026-01-05",
      ),
    ).toBe(true);
  });
});
