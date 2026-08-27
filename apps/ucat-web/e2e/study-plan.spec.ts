import { devices, expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { UCAT_TOUR_VERSIONS } from "@/features/onboarding/config/tour-catalog";
import {
  UCAT_STUDY_ORB_INTRO_SEEN,
  UCAT_STUDY_PLAN_DECIDED,
} from "@/features/onboarding/lib/activation-milestones";

const password = "test-password";

function localAdmin() {
  const url = process.env.UCAT_E2E_SUPABASE_URL;
  const key = process.env.UCAT_E2E_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("The local Supabase E2E environment is unavailable.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function signIn(page: Page, email: string) {
  const admin = localAdmin();
  const { data: student, error: studentError } = await admin
    .from("students")
    .select("id,onboarding_progress")
    .eq("email", email)
    .single();
  if (studentError) throw studentError;
  const existingProgress =
    student.onboarding_progress &&
    typeof student.onboarding_progress === "object" &&
    !Array.isArray(student.onboarding_progress)
      ? student.onboarding_progress
      : {};
  const completedAt = new Date().toISOString();
  const completedTutorials = Object.fromEntries(
    [
      ...Object.entries(UCAT_TOUR_VERSIONS),
      [UCAT_STUDY_ORB_INTRO_SEEN, 1],
      [UCAT_STUDY_PLAN_DECIDED, 1],
    ].map(([tourId, version]) => [
      tourId,
      { completed_at: completedAt, version },
    ]),
  );
  const { error: progressError } = await admin
    .from("students")
    .update({
      ucat_signup_step: 4,
      ucat_signup_completed_at: completedAt,
      ucat_onboarding_completed_at: completedAt,
      onboarding_progress: { ...existingProgress, ...completedTutorials },
    })
    .eq("id", student.id);
  if (progressError) throw progressError;
  const { error: relationshipError } = await admin
    .from("student_online_product_relationships")
    .upsert(
      {
        student_id: student.id,
        product: "UCAT_WEB",
        closed_at: null,
      },
      { onConflict: "student_id,product" },
    );
  if (relationshipError) throw relationshipError;

  page.on("response", async (response) => {
    if (response.url().includes("/api/ucat/study-plan") && !response.ok()) {
      console.error(
        "Study plan API failure:",
        response.status(),
        await response.text(),
      );
    }
  });
  await page.goto("/login?redirect=/study-plan");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/study-plan");
  await expect(page.getByRole("heading", { name: "Study plan" })).toBeVisible({
    timeout: 30_000,
  });
}

async function selectCalendarDate(page: Page, dateKey: string) {
  const calendar = page.getByRole("region", { name: "Study plan calendar" });
  await expect(calendar).toBeVisible({ timeout: 30_000 });
  const targetMonth = dateKey.slice(0, 7);

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const visibleMonth = await calendar.getAttribute("data-visible-month");
    if (visibleMonth === targetMonth) break;
    const direction =
      visibleMonth && visibleMonth > targetMonth
        ? "Previous month"
        : "Next month";
    const button = calendar.getByRole("button", { name: direction });
    if (await button.isDisabled()) {
      throw new Error(`Could not reach calendar month ${targetMonth}.`);
    }
    await button.click();
    await expect(calendar).not.toHaveAttribute(
      "data-visible-month",
      visibleMonth ?? "",
    );
  }

  const targetDate = calendar.locator(`[data-study-plan-date="${dateKey}"]`);
  if ((await targetDate.getAttribute("aria-pressed")) !== "true") {
    await targetDate.click();
  }
}

test.describe("personalised Study plan", () => {
  test("generates canonical practice and linked review tasks", async ({
    page,
  }) => {
    const admin = localAdmin();
    const { error: generationResetError } = await admin
      .from("ucat_student_study_plan_generations")
      .delete()
      .eq("student_id", "10000000-0000-0000-0000-000000000001");
    if (generationResetError) throw generationResetError;
    await signIn(page, "alice.williams@student.test");

    await expect(
      page.getByRole("region", { name: "Study plan calendar" }),
    ).toBeVisible();
    const { data: generatedTasks, error: generatedTasksError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("task_type,source_task_id,launch_config,scheduled_date")
      .eq("student_id", "10000000-0000-0000-0000-000000000001");
    if (generatedTasksError) throw generatedTasksError;
    expect(
      generatedTasks?.some((task) => task.task_type === "practice"),
    ).toBe(true);
    expect(generatedTasks?.some((task) => task.task_type === "review")).toBe(
      true,
    );
    expect(
      generatedTasks
        ?.filter((task) => task.task_type === "review")
        .every((task) => task.source_task_id != null),
    ).toBe(true);
    expect(
      generatedTasks
        ?.filter((task) => task.task_type === "practice")
        .every((task) => {
          const config = task.launch_config as Record<string, unknown> | null;
          return (
            typeof config?.activityCandidateId === "string" &&
            typeof config?.preparationPhase === "string"
          );
        }),
    ).toBe(true);
    const firstReviewDate = generatedTasks?.find(
      (task) => task.task_type === "review",
    )?.scheduled_date;
    if (!firstReviewDate) throw new Error("Alice has no planned review task.");
    await selectCalendarDate(page, firstReviewDate);
    await expect(
      page.getByRole("button", { name: "Finish attempt first" }).first(),
    ).toBeDisabled();
    await expect(page.getByText(/Full mock \d+/)).toHaveCount(0);

    await expect(
      page.getByRole("complementary", { name: "Study guidance" }),
    ).toBeVisible();
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Good to see you, Alice" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "View Study plan" })).toBeVisible();
  });

  test("warns but still generates a plan for constrained availability", async ({
    page,
  }) => {
    await signIn(page, "bob.taylor@student.test");

    await expect(page.getByText("Your plan is prioritising")).toBeVisible();
    await expect(
      page.getByText("This is guidance, not a block."),
    ).toBeVisible();
    await expect(page.getByText(/section-equivalents/i)).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Study plan calendar" }),
    ).toBeVisible();
  });

  test("adds one extra block today without moving existing future tasks", async ({
    page,
  }) => {
    const admin = localAdmin();
    const studentId = "10000000-0000-0000-0000-000000000001";
    const { error: generationResetError } = await admin
      .from("ucat_student_study_plan_generations")
      .delete()
      .eq("student_id", studentId);
    if (generationResetError) throw generationResetError;
    await signIn(page, "alice.williams@student.test");
    await expect(
      page.getByRole("region", { name: "Study plan calendar" }),
    ).toBeVisible({
      timeout: 30_000,
    });

    const { data: generation, error: generationError } = await admin
      .from("ucat_student_study_plan_generations")
      .select("id, starts_on")
      .eq("student_id", studentId)
      .is("superseded_at", null)
      .single();
    if (generationError) throw generationError;
    const { data: originalTasks, error: originalTasksError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("id, scheduled_date, sort_order")
      .eq("generation_id", generation.id)
      .order("scheduled_date")
      .order("sort_order");
    if (originalTasksError) throw originalTasksError;
    const futureTasks = (originalTasks ?? []).filter(
      (task) => task.scheduled_date > generation.starts_on,
    );
    const { error: completeTodayError } = await admin
      .from("ucat_student_study_plan_tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_units: 1,
      })
      .eq("generation_id", generation.id)
      .eq("scheduled_date", generation.starts_on);
    if (completeTodayError) throw completeTodayError;

    await page.reload();
    const extraButton = page.getByRole("button", {
      name: /I have time for more|I’d like to study today/,
    });
    await expect(extraButton).toBeVisible({ timeout: 30_000 });
    await extraButton.click();
    await expect(
      page.getByRole("heading", { name: "How much time do you have?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "30 min" }).click();
    await page.getByRole("button", { name: "Choose a section instead" }).click();
    await page.getByRole("button", { name: "VR" }).click();
    const extraResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/ucat/study-plan/extra") &&
        response.request().method() === "POST" &&
        response.ok(),
    );
    await page.getByRole("button", { name: "Add to today" }).click();
    await extraResponse;

    const { data: nextTasks, error: nextTasksError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select(
        "id, scheduled_date, sort_order, task_type, launch_config, source_task_id",
      )
      .eq("generation_id", generation.id)
      .order("scheduled_date")
      .order("sort_order");
    if (nextTasksError) throw nextTasksError;
    const extraTasks = (nextTasks ?? []).filter((task) => {
      const config = task.launch_config as { extraStudy?: boolean } | null;
      return task.scheduled_date === generation.starts_on && config?.extraStudy;
    });
    expect(extraTasks.length).toBeGreaterThanOrEqual(1);
    expect(extraTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          launch_config: expect.objectContaining({
            extraStudy: true,
            requestedMinutes: 30,
            requestedSectionKey: "verbal_reasoning",
          }),
        }),
      ]),
    );
    const nextTaskIds = new Set((nextTasks ?? []).map((task) => task.id));
    expect(futureTasks.every((task) => nextTaskIds.has(task.id))).toBe(true);
    const extraPractice = extraTasks.find(
      (task) => task.task_type === "practice",
    );
    const deferredReview = (nextTasks ?? []).find(
      (task) =>
        task.scheduled_date > generation.starts_on &&
        task.source_task_id === extraPractice?.id,
    );
    expect(deferredReview).toBeDefined();
    await expect(extraButton).toHaveCount(0);
  });

  test("keeps today's task ids and progress when planning settings change", async ({
    page,
  }) => {
    const admin = localAdmin();
    const studentId = "10000000-0000-0000-0000-000000000001";
    const { error: generationResetError } = await admin
      .from("ucat_student_study_plan_generations")
      .delete()
      .eq("student_id", studentId);
    if (generationResetError) throw generationResetError;
    await signIn(page, "alice.williams@student.test");
    await expect(
      page.getByRole("region", { name: "Study plan calendar" }),
    ).toBeVisible({
      timeout: 30_000,
    });

    const { data: profile, error: profileError } = await admin
      .from("ucat_student_study_plan_profiles")
      .select(
        "target_score,test_year,test_date,available_days,preferred_mock_weekday",
      )
      .eq("student_id", studentId)
      .single();
    if (profileError) throw profileError;
    const { data: generation, error: generationError } = await admin
      .from("ucat_student_study_plan_generations")
      .select("id,starts_on")
      .eq("student_id", studentId)
      .is("superseded_at", null)
      .single();
    if (generationError) throw generationError;
    const { data: existingFirstTask, error: firstTaskError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("id")
      .eq("generation_id", generation.id)
      .eq("scheduled_date", generation.starts_on)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (firstTaskError) throw firstTaskError;
    const firstTask = existingFirstTask ?? { id: randomUUID() };
    if (!existingFirstTask) {
      const { error: insertTaskError } = await admin
        .from("ucat_student_study_plan_tasks")
        .insert({
          id: firstTask.id,
          generation_id: generation.id,
          student_id: studentId,
          scheduled_date: generation.starts_on,
          sort_order: 0,
          task_type: "learn",
          title: "E2E progress marker",
          estimated_minutes: 5,
        });
      if (insertTaskError) throw insertTaskError;
    }
    const completedAt = new Date().toISOString();
    const { error: completionError } = await admin
      .from("ucat_student_study_plan_tasks")
      .update({
        status: "completed",
        completed_at: completedAt,
        completed_units: 1,
      })
      .eq("id", firstTask.id);
    if (completionError) throw completionError;
    const dependentSourceId = randomUUID();
    const dependentReviewId = randomUUID();
    const reviewDate = new Date(`${generation.starts_on}T00:00:00Z`);
    reviewDate.setUTCDate(reviewDate.getUTCDate() + 1);
    const reviewDateKey = reviewDate.toISOString().slice(0, 10);
    const { data: occupied, error: occupiedError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("scheduled_date,sort_order")
      .eq("generation_id", generation.id)
      .in("scheduled_date", [generation.starts_on, reviewDateKey]);
    if (occupiedError) throw occupiedError;
    const nextSortOrder = (date: string) =>
      Math.max(
        -1,
        ...(occupied ?? [])
          .filter((task) => task.scheduled_date === date)
          .map((task) => task.sort_order),
      ) + 1;
    const { error: dependentTasksError } = await admin
      .from("ucat_student_study_plan_tasks")
      .insert([
        {
          id: dependentSourceId,
          generation_id: generation.id,
          student_id: studentId,
          scheduled_date: generation.starts_on,
          sort_order: nextSortOrder(generation.starts_on),
          task_type: "practice",
          status: "completed",
          title: "E2E preserved practice",
          estimated_minutes: 5,
          completed_units: 5,
          completed_at: completedAt,
        },
        {
          id: dependentReviewId,
          generation_id: generation.id,
          student_id: studentId,
          scheduled_date: reviewDateKey,
          sort_order: nextSortOrder(reviewDateKey),
          task_type: "review",
          status: "planned",
          completed_units: 0,
          title: "Review · E2E preserved practice",
          estimated_minutes: 3,
          source_task_id: dependentSourceId,
        },
      ]);
    if (dependentTasksError) throw dependentTasksError;
    const { data: before, error: beforeError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("id,status,completed_at,matched_activity_id")
      .eq("generation_id", generation.id)
      .lte("scheduled_date", generation.starts_on)
      .order("scheduled_date")
      .order("sort_order");
    if (beforeError) throw beforeError;

    const response = await page.request.put("/api/ucat/study-plan", {
      data: {
        targetScore: Math.min(2700, profile.target_score + 10),
        testYear: profile.test_year,
        testDate: profile.test_date,
        availableDays: profile.available_days,
        preferredMockWeekday: profile.preferred_mock_weekday,
        studyPlanEnabled: true,
      },
    });
    expect(response.ok()).toBe(true);
    const { data: nextGeneration, error: nextGenerationError } = await admin
      .from("ucat_student_study_plan_generations")
      .select("id")
      .eq("student_id", studentId)
      .is("superseded_at", null)
      .single();
    if (nextGenerationError) throw nextGenerationError;
    const { data: after, error: afterError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("id,status,completed_at,matched_activity_id")
      .eq("generation_id", nextGeneration.id)
      .lte("scheduled_date", generation.starts_on)
      .order("scheduled_date")
      .order("sort_order");
    if (afterError) throw afterError;
    expect(after).toEqual(before);
    const { data: carriedReview, error: carriedReviewError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("generation_id,source_task_id")
      .eq("id", dependentReviewId)
      .single();
    if (carriedReviewError) throw carriedReviewError;
    expect(carriedReview).toEqual({
      generation_id: nextGeneration.id,
      source_task_id: dependentSourceId,
    });
  });

  test("unlocks a mock only for the persona with graduated cognitive sections", async ({
    page,
  }) => {
    const admin = localAdmin();
    const studentId = "10000000-0000-0000-0000-000000000003";
    const { data: profile, error: profileError } = await admin
      .from("ucat_student_study_plan_profiles")
      .select("test_year")
      .eq("student_id", studentId)
      .single();
    if (profileError) throw profileError;
    const { data: cognitiveSections, error: sectionsError } = await admin
      .from("ucat_sections")
      .select("id")
      .lte("section_number", 3);
    if (sectionsError) throw sectionsError;
    const { error: graduationError } = await admin
      .from("ucat_student_preparation_section_states")
      .upsert(
        (cognitiveSections ?? []).map((section) => ({
          student_id: studentId,
          test_year: profile.test_year,
          section_id: section.id,
          learning_graduated_at: new Date().toISOString(),
          learning_graduation_route: "accuracy",
          policy_version: "evidence-driven-preparation-policy-v5",
          evidence_snapshot: { fixture: "experienced-e2e-persona" },
        })),
        { onConflict: "student_id,test_year,section_id" },
      );
    if (graduationError) throw graduationError;
    const { error: generationResetError } = await admin
      .from("ucat_student_study_plan_generations")
      .delete()
      .eq("student_id", studentId);
    if (generationResetError) throw generationResetError;
    await signIn(page, "charlie.martinez@student.test");

    await expect(
      page.getByRole("region", { name: "Study plan calendar" }),
    ).toBeVisible({
      timeout: 30_000,
    });
    const { data: mockTask, error: mockTaskError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("scheduled_date,title")
      .eq("student_id", studentId)
      .eq("task_type", "mock")
      .order("scheduled_date")
      .limit(1)
      .maybeSingle();
    if (mockTaskError) throw mockTaskError;
    if (!mockTask?.scheduled_date)
      throw new Error("Charlie has no planned mock task.");
    await selectCalendarDate(page, mockTask.scheduled_date);
    await expect(page.getByText(mockTask.title).first()).toBeVisible();
  });

  test("marks a learning task complete after completing the lesson", async ({
    page,
  }) => {
    const admin = localAdmin();
    const studentId = "10000000-0000-0000-0000-000000000004";
    const moduleId = "f2000000-0000-4000-8000-000000000001";
    const { error: progressError } = await admin
      .from("ucat_student_learning_module_progress")
      .upsert(
        {
          student_id: studentId,
          learning_module_id: moduleId,
          completion_percent: 50,
          completed_at: null,
        },
        { onConflict: "student_id,learning_module_id" },
      );
    if (progressError) throw progressError;
    const futureTestDate = new Date();
    futureTestDate.setUTCDate(futureTestDate.getUTCDate() + 90);
    const futureTestDateKey = futureTestDate.toISOString().slice(0, 10);
    const { error: profileUpdateError } = await admin
      .from("ucat_student_study_plan_profiles")
      .update({
        test_date: futureTestDateKey,
        test_year: futureTestDate.getUTCFullYear(),
      })
      .eq("student_id", studentId);
    if (profileUpdateError) throw profileUpdateError;
    const { error: generationError } = await admin
      .from("ucat_student_study_plan_generations")
      .delete()
      .eq("student_id", studentId);
    if (generationError) throw generationError;

    await signIn(page, "diana.garcia@student.test");
    await expect(
      page.getByRole("region", { name: "Study plan calendar" }),
    ).toBeVisible({
      timeout: 30_000,
    });
    const title = "Reading comprehension foundations";
    const { data: learningTask, error: learningTaskError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("scheduled_date,section_id,estimated_minutes")
      .eq("student_id", studentId)
      .eq("learning_module_id", moduleId)
      .order("scheduled_date")
      .limit(1)
      .maybeSingle();
    if (learningTaskError) throw learningTaskError;
    if (!learningTask?.scheduled_date)
      throw new Error("Diana has no planned learning task.");
    expect(learningTask.estimated_minutes).toBeLessThanOrEqual(20);
    const { data: learningDayTasks, error: learningDayTasksError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("task_type,section_id")
      .eq("student_id", studentId)
      .eq("scheduled_date", learningTask.scheduled_date);
    if (learningDayTasksError) throw learningDayTasksError;
    expect(
      learningDayTasks?.some(
        (plannedTask) =>
          plannedTask.task_type === "practice" &&
          plannedTask.section_id === learningTask.section_id,
      ),
    ).toBe(true);
    expect(
      learningDayTasks?.some(
        (plannedTask) =>
          plannedTask.task_type === "review" &&
          plannedTask.section_id === learningTask.section_id,
      ),
    ).toBe(true);
    await selectCalendarDate(page, learningTask.scheduled_date);
    const task = page.locator("li").filter({ hasText: title }).first();
    await expect(task).toContainText("In progress");
    await expect(task).not.toContainText("Learning phase");
    await expect(task).not.toContainText(/\d\.\d× pace/);
    await task.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL((url) => url.pathname.endsWith(`/${moduleId}`));
    await page.getByRole("button", { name: "Mark lesson complete" }).click();
    await page.getByRole("button", { name: "Mark complete" }).click();
    await expect(page.getByText("100% complete")).toBeVisible();
    await expect(
      page
        .getByRole("complementary", { name: "Study guidance" })
        .getByText(`${title} complete`),
    ).toBeVisible({ timeout: 15_000 });

    await page.goto("/study-plan");
    await selectCalendarDate(page, learningTask.scheduled_date);
    const completedTask = page.locator("li").filter({ hasText: title }).first();
    await expect(completedTask.getByText(title)).toHaveClass(/line-through/);
    await expect(
      completedTask.getByRole("button", { name: "Continue" }),
    ).toHaveCount(0);
  });

  test("reconciles category-matched practice and completes its linked review", async ({
    page,
  }) => {
    const admin = localAdmin();
    const studentId = "10000000-0000-0000-0000-000000000006";
    const { error: generationResetError } = await admin
      .from("ucat_student_study_plan_generations")
      .delete()
      .eq("student_id", studentId);
    if (generationResetError) throw generationResetError;
    const { error: sessionResetError } = await admin
      .from("student_practice_sessions")
      .delete()
      .eq("student_id", studentId);
    if (sessionResetError) throw sessionResetError;
    const { data: profile, error: profileError } = await admin
      .from("ucat_student_study_plan_profiles")
      .select("id,test_date")
      .eq("student_id", studentId)
      .single();
    if (profileError) throw profileError;
    const planningDate = new Date().toLocaleDateString("en-CA", {
      timeZone: "Australia/Adelaide",
    });
    const generationId = randomUUID();
    const { error: generationFixtureError } = await admin
      .from("ucat_student_study_plan_generations")
      .insert({
        id: generationId,
        student_id: studentId,
        profile_id: profile.id,
        reason: "manual",
        planning_date: planningDate,
        starts_on: planningDate,
        ends_on: profile.test_date,
      });
    if (generationFixtureError) throw generationFixtureError;
    await signIn(page, "fiona.harris@student.test");

    const { data: generation, error: generationError } = await admin
      .from("ucat_student_study_plan_generations")
      .select("id,starts_on")
      .eq("student_id", studentId)
      .is("superseded_at", null)
      .single();
    if (generationError) throw generationError;
    expect(generation.id).toBe(generationId);
    const { data: section, error: sectionError } = await admin
      .from("ucat_sections")
      .select("id")
      .eq("section_number", 2)
      .single();
    if (sectionError) throw sectionError;
    const { data: category, error: categoryError } = await admin
      .from("question_stem_categories")
      .select("id")
      .eq("ucat_section_id", section.id)
      .limit(1)
      .single();
    if (categoryError) throw categoryError;
    const { data: dayTasks, error: dayTasksError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("sort_order")
      .eq("generation_id", generation.id)
      .eq("scheduled_date", generation.starts_on);
    if (dayTasksError) throw dayTasksError;
    const sourceSortOrder =
      Math.max(-1, ...(dayTasks ?? []).map((item) => item.sort_order)) + 1;
    const task = {
      id: randomUUID(),
      title: "E2E category practice",
      target_units: 10,
      section_id: section.id,
      question_stem_category_id: category.id,
    };
    const linkedReview = {
      id: randomUUID(),
      scheduled_date: generation.starts_on,
    };
    const { error: fixtureError } = await admin
      .from("ucat_student_study_plan_tasks")
      .insert([
        {
          id: task.id,
          generation_id: generation.id,
          student_id: studentId,
          scheduled_date: generation.starts_on,
          sort_order: sourceSortOrder,
          task_type: "practice",
          status: "planned",
          title: task.title,
          estimated_minutes: 10,
          target_units: task.target_units,
          completed_units: 0,
          section_id: task.section_id,
          question_stem_category_id: task.question_stem_category_id,
          launch_path: "/practice",
          launch_config: { section: "decision_making" },
        },
        {
          id: linkedReview.id,
          generation_id: generation.id,
          student_id: studentId,
          scheduled_date: linkedReview.scheduled_date,
          sort_order: sourceSortOrder + 1,
          task_type: "review",
          status: "planned",
          title: `Review · ${task.title}`,
          estimated_minutes: 3,
          completed_units: 0,
          source_task_id: task.id,
          launch_path: "/progress",
          launch_config: { kind: "review", awaitingAttempt: true },
        },
      ]);
    if (fixtureError) throw fixtureError;
    const completedQuestions = Math.max(1, task.target_units - 1);
    const sessionId = randomUUID();
    const completedAt = new Date().toISOString();
    const { error: sessionError } = await admin
      .from("student_practice_sessions")
      .insert({
        id: sessionId,
        student_id: studentId,
        ucat_section_id: task.section_id,
        section_key: "decision_making",
        filters_snapshot: {
          categoryIds: [task.question_stem_category_id],
          questionCount: task.target_units,
          studyPlanTaskId: task.id,
          timeMode: "speed",
          reviewTiming: "atEnd",
        },
        stems_snapshot: [],
        score_points: completedQuestions,
        total_points: completedQuestions,
        question_count: completedQuestions,
        started_at: completedAt,
        completed_at: completedAt,
        unlimited: false,
      });
    if (sessionError) throw sessionError;
    const { error: legacyPartialError } = await admin
      .from("ucat_student_study_plan_tasks")
      .update({
        status: "partial",
        completed_units: completedQuestions,
        matched_activity_type: "practice_session",
        matched_activity_id: sessionId,
      })
      .eq("id", task.id);
    if (legacyPartialError) throw legacyPartialError;

    await page.reload();
    await selectCalendarDate(page, linkedReview.scheduled_date);
    const reviewTitle = `Review · ${task.title}`;
    const reviewTask = page
      .locator("li")
      .filter({ hasText: reviewTitle })
      .first();
    await expect(
      reviewTask.getByRole("button", { name: "Review now" }),
    ).toBeVisible();
    const completionResponse = await page.request.patch(
      `/api/ucat/study-plan/tasks/${linkedReview.id}`,
      { data: { action: "complete" } },
    );
    expect(completionResponse.ok()).toBe(true);

    await page.goto("/study-plan");
    const completedReview = page
      .locator("li")
      .filter({ hasText: reviewTitle })
      .first();
    await expect(completedReview.getByText(reviewTitle)).toHaveClass(
      /line-through/,
    );
  });

  test("an active practice attempt survives refresh, reconnection, and a device switch @critical", async ({
    browser,
    page,
  }) => {
    test.setTimeout(120_000);
    const admin = localAdmin();
    const studentId = "10000000-0000-0000-0000-000000000006";
    const { error: generationResetError } = await admin
      .from("ucat_student_study_plan_generations")
      .delete()
      .eq("student_id", studentId);
    if (generationResetError) throw generationResetError;
    const { error: sessionResetError } = await admin
      .from("student_practice_sessions")
      .delete()
      .eq("student_id", studentId);
    if (sessionResetError) throw sessionResetError;
    const { error: accessError } = await admin
      .from("students")
      .update({ ucat_online_tier_override: "force_unlimited" })
      .eq("id", studentId);
    if (accessError) throw accessError;

    await signIn(page, "fiona.harris@student.test");
    const { data: profile, error: profileError } = await admin
      .from("ucat_student_study_plan_profiles")
      .select(
        "target_score,test_year,test_date,available_days,preferred_mock_weekday,sjt_preference",
      )
      .eq("student_id", studentId)
      .single();
    if (profileError) throw profileError;
    const generationResponse = await page.request.put("/api/ucat/study-plan", {
      data: {
        studyPlanEnabled: true,
        targetScore: profile.target_score,
        testYear: profile.test_year,
        testDate: profile.test_date,
        availableDays: profile.available_days,
        preferredMockWeekday: profile.preferred_mock_weekday,
        sjtPreference: profile.sjt_preference,
      },
    });
    expect(generationResponse.ok()).toBe(true);
    await page.reload();
    await expect
      .poll(
        async () => {
          const { data, error } = await admin
            .from("ucat_student_study_plan_tasks")
            .select("id, title, scheduled_date")
            .eq("student_id", studentId)
            .eq("task_type", "practice")
            .order("scheduled_date")
            .order("sort_order")
            .limit(1)
            .maybeSingle();
          if (error) throw error;
          return data?.id ?? null;
        },
        { timeout: 30_000 },
      )
      .not.toBeNull();
    const { data: task, error: taskError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("id, title, scheduled_date")
      .eq("student_id", studentId)
      .eq("task_type", "practice")
      .order("scheduled_date")
      .order("sort_order")
      .limit(1)
      .single();
    if (taskError) throw taskError;
    if (!task?.title) throw new Error("Fiona has no planned practice task.");
    await selectCalendarDate(page, task.scheduled_date);
    await expect(page.getByText(/Review ·/).first()).toBeVisible({
      timeout: 30_000,
    });

    const practiceTask = page
      .locator("li")
      .filter({ hasText: task.title })
      .first();
    await practiceTask.getByRole("button", { name: "Start" }).click();
    await page.waitForURL((url) => url.pathname === "/exam", {
      timeout: 30_000,
    });

    await expect(
      page.getByRole("complementary", { name: "Study guidance" }),
    ).toHaveCount(0);
    const { data: session, error: sessionError } = await admin
      .from("student_practice_sessions")
      .select("id, stems_snapshot, filters_snapshot")
      .eq("student_id", studentId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sessionError) throw sessionError;
    const stems = Array.isArray(session?.stems_snapshot)
      ? (session.stems_snapshot as Array<{ questions?: unknown[] }>)
      : [];
    const deliveredCount = stems.reduce(
      (total, stem) =>
        total + (Array.isArray(stem.questions) ? stem.questions.length : 0),
      0,
    );
    expect(deliveredCount).toBeGreaterThan(0);
    expect(session?.filters_snapshot).toMatchObject({
      studyPlanTaskId: task.id,
    });
    if (!session?.id)
      throw new Error("The practice session was not persisted.");

    await page.reload();
    await expect(page).toHaveURL((url) => url.pathname === "/exam");

    await page.context().setOffline(true);
    await page.context().setOffline(false);
    await page.reload();
    await expect(page).toHaveURL((url) => url.pathname === "/exam");

    const storage = await page.context().storageState();
    const deviceContext = await browser.newContext({
      ...devices["Pixel 7"],
      storageState: { cookies: storage.cookies, origins: [] },
    });
    try {
      const devicePage = await deviceContext.newPage();
      const resumedSession = devicePage.waitForResponse(
        (response) =>
          response
            .url()
            .includes(`/api/ucat/practice-sessions/${session.id}`) &&
          response.ok(),
      );
      await devicePage.goto(new URL("/exam", page.url()).toString());
      await resumedSession;
      await expect(devicePage).toHaveURL((url) => url.pathname === "/exam");
    } finally {
      await deviceContext.close();
    }

    await page.goto("/exam/tutorial");
    await expect(
      page.getByRole("complementary", { name: "Study guidance" }),
    ).toHaveCount(0);
  });

  test("covers setup, no-plan guidance, alternatives, missed work, mock replacement, and estimate consistency", async ({
    page,
  }) => {
    const admin = localAdmin();
    const studentId = "10000000-0000-0000-0000-000000000001";
    const { data: originalProfile, error: profileError } = await admin
      .from("ucat_student_study_plan_profiles")
      .select(
        "target_score,test_year,test_date,available_days,preferred_mock_weekday,sjt_preference",
      )
      .eq("student_id", studentId)
      .single();
    if (profileError) throw profileError;
    await signIn(page, "alice.williams@student.test");

    const profileInput = {
      targetScore: originalProfile.target_score,
      testYear: originalProfile.test_year,
      testDate: originalProfile.test_date,
      availableDays: originalProfile.available_days,
      preferredMockWeekday: originalProfile.preferred_mock_weekday,
      sjtPreference: originalProfile.sjt_preference,
    };
    const disabledResponse = await page.request.put("/api/ucat/study-plan", {
      data: { ...profileInput, studyPlanEnabled: false },
    });
    expect(disabledResponse.ok()).toBe(true);
    const disabledPlan = await disabledResponse.json();
    expect(disabledPlan.profile.studyPlanEnabled).toBe(false);
    expect(disabledPlan.generation).toBeNull();
    expect(disabledPlan.nextSteps.length).toBeGreaterThan(0);

    const alternativeResponse = await page.request.post(
      "/api/ucat/study-plan/alternative",
      {
        data: {
          excludedKeys: [],
          currentTaskTypes: disabledPlan.nextSteps
            .slice(0, 6)
            .map((step: { taskType: string }) => step.taskType),
        },
      },
    );
    expect(alternativeResponse.ok()).toBe(true);
    expect(await alternativeResponse.json()).toMatchObject({
      launchConfig: { activityCandidateId: expect.any(String) },
    });

    const enabledResponse = await page.request.put("/api/ucat/study-plan", {
      data: { ...profileInput, studyPlanEnabled: true },
    });
    expect(enabledResponse.ok()).toBe(true);
    const enabledPlan = await enabledResponse.json();
    expect(enabledPlan.generation).not.toBeNull();
    expect(enabledPlan.tasks.length).toBeGreaterThan(0);

    const yesterday = new Date(`${enabledPlan.today}T00:00:00.000Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const missedTaskId = randomUUID();
    const { error: missedTaskError } = await admin
      .from("ucat_student_study_plan_tasks")
      .insert({
        id: missedTaskId,
        generation_id: enabledPlan.generation.id,
        student_id: studentId,
        scheduled_date: yesterday.toISOString().slice(0, 10),
        sort_order: 999,
        task_type: "practice",
        status: "planned",
        title: "E2E missed canonical work",
        estimated_minutes: 10,
        target_units: 5,
      });
    if (missedTaskError) throw missedTaskError;
    const missedResponse = await page.request.get("/api/ucat/study-plan");
    expect(missedResponse.ok()).toBe(true);
    const replanned = await missedResponse.json();
    expect(replanned.generation.id).not.toBe(enabledPlan.generation.id);
    expect(replanned.generation.reason).toBe("significant_activity");

    const { data: generationRow, error: generationError } = await admin
      .from("ucat_student_study_plan_generations")
      .select("id,input_snapshot")
      .eq("id", replanned.generation.id)
      .single();
    if (generationError) throw generationError;
    const inputSnapshot = generationRow.input_snapshot as Record<
      string,
      unknown
    >;
    const { error: mockFixtureError } = await admin
      .from("ucat_student_study_plan_generations")
      .update({ input_snapshot: { ...inputSnapshot, completedMockCount: -1 } })
      .eq("id", generationRow.id);
    if (mockFixtureError) throw mockFixtureError;
    const mockResponse = await page.request.get("/api/ucat/study-plan");
    expect(mockResponse.ok()).toBe(true);
    const mockReplanned = await mockResponse.json();
    expect(mockReplanned.generation.id).not.toBe(replanned.generation.id);
    expect(mockReplanned.generation.reason).toBe("mock_completed");

    const scoreResponse = await page.request.get("/api/ucat/score-projection");
    const scoreProjection = await scoreResponse.json();
    expect(scoreResponse.ok(), JSON.stringify(scoreProjection)).toBe(true);
    const cognitiveEstimates: Array<number | null> = scoreProjection.sections
      .filter((section: { sectionNumber: number }) => section.sectionNumber <= 3)
      .map((section: { currentEstimate: number | null }) =>
        section.currentEstimate,
      );
    const cognitiveTotal = cognitiveEstimates.reduce(
        (
          total: number,
          estimate: number | null,
        ) => total + (estimate ?? 0),
        0,
      );
    const { data: snapshot, error: snapshotError } = await admin
      .from("ucat_preparation_snapshots")
      .select("snapshot")
      .eq("student_id", studentId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .single();
    if (snapshotError) throw snapshotError;
    const snapshotEstimate = (
      snapshot.snapshot as {
        currentScore: { currentEstimate: number | null };
      }
    ).currentScore.currentEstimate;
    if (snapshotEstimate == null) {
      expect(cognitiveEstimates.every((estimate) => estimate == null)).toBe(true);
    } else {
      expect(cognitiveTotal).toBe(snapshotEstimate);
    }
  });
});
