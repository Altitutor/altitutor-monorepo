import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const password = "test-password";

function localAdmin() {
  const url = process.env.UCAT_E2E_SUPABASE_URL;
  const key = process.env.UCAT_E2E_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("The local Supabase E2E environment is unavailable.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function signIn(page: Page, email: string) {
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

  await calendar.locator(`[data-study-plan-date="${dateKey}"]`).click();
}

test.describe("personalised Study plan", () => {
  test("generates category practice, warm-ups, and linked review tasks", async ({
    page,
  }) => {
    const admin = localAdmin();
    const { error: generationResetError } = await admin
      .from("ucat_student_study_plan_generations")
      .delete()
      .eq("student_id", "10000000-0000-0000-0000-000000000001");
    if (generationResetError) throw generationResetError;
    await signIn(page, "alice.williams@student.test");

    await expect(page.getByLabel("Study plan calendar")).toBeVisible();
    const { data: generatedTasks, error: generatedTasksError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("task_type,question_stem_category_id")
      .eq("student_id", "10000000-0000-0000-0000-000000000001");
    if (generatedTasksError) throw generatedTasksError;
    expect(
      generatedTasks?.some((task) => task.task_type === "skill_trainer"),
    ).toBe(true);
    expect(generatedTasks?.some((task) => task.task_type === "review")).toBe(
      true,
    );
    expect(
      generatedTasks?.some((task) => task.question_stem_category_id != null),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Finish attempt first" }).first(),
    ).toBeDisabled();
    await expect(page.getByText(/Full mock \d+/)).toHaveCount(0);

    await expect(
      page.getByRole("complementary", { name: "Study plan companion" }),
    ).toHaveCount(0);
    await page.goto("/dashboard");
    await expect(page.getByText("What now").first()).toBeVisible();
  });

  test("warns but still generates a plan for constrained availability", async ({
    page,
  }) => {
    await signIn(page, "bob.taylor@student.test");

    await expect(page.getByText("There is a capacity gap")).toBeVisible();
    await expect(
      page.getByText("This is guidance, not a block."),
    ).toBeVisible();
    await expect(page.getByLabel("Study plan calendar")).toBeVisible();
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
    await expect(page.getByLabel("Study plan calendar")).toBeVisible({
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
      .select("id, scheduled_date, sort_order, launch_config")
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
            requestedSectionKey: null,
          }),
        }),
      ]),
    );
    const nextTaskIds = new Set((nextTasks ?? []).map((task) => task.id));
    expect(futureTasks.every((task) => nextTaskIds.has(task.id))).toBe(true);
    const deferredReview = (nextTasks ?? []).find((task) => {
      const config = task.launch_config as {
        sourceTaskScheduledDate?: string;
      } | null;
      return (
        task.scheduled_date > generation.starts_on &&
        config?.sourceTaskScheduledDate === generation.starts_on
      );
    });
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
    await expect(page.getByLabel("Study plan calendar")).toBeVisible({
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
  });

  test("unlocks a mock only for the persona with completed cognitive section sets", async ({
    page,
  }) => {
    await signIn(page, "charlie.martinez@student.test");

    await expect(page.getByLabel("Study plan calendar")).toBeVisible({
      timeout: 30_000,
    });
    const admin = localAdmin();
    const { data: mockTask, error: mockTaskError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("scheduled_date")
      .eq("student_id", "10000000-0000-0000-0000-000000000003")
      .eq("task_type", "mock")
      .order("scheduled_date")
      .limit(1)
      .maybeSingle();
    if (mockTaskError) throw mockTaskError;
    if (!mockTask?.scheduled_date)
      throw new Error("Charlie has no planned mock task.");
    await selectCalendarDate(page, mockTask.scheduled_date);
    await expect(page.getByText(/Full mock \d+/).first()).toBeVisible();
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
    const { error: generationError } = await admin
      .from("ucat_student_study_plan_generations")
      .delete()
      .eq("student_id", studentId);
    if (generationError) throw generationError;

    await signIn(page, "diana.garcia@student.test");
    await expect(page.getByLabel("Study plan calendar")).toBeVisible({
      timeout: 30_000,
    });
    const title = "Reading comprehension foundations";
    const { data: learningTask, error: learningTaskError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("scheduled_date")
      .eq("student_id", studentId)
      .eq("learning_module_id", moduleId)
      .order("scheduled_date")
      .limit(1)
      .maybeSingle();
    if (learningTaskError) throw learningTaskError;
    if (!learningTask?.scheduled_date)
      throw new Error("Diana has no planned learning task.");
    await selectCalendarDate(page, learningTask.scheduled_date);
    const task = page.locator("li").filter({ hasText: title }).first();
    await expect(task).toContainText("In progress");
    await task.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(new RegExp(`/learn/${moduleId}`));
    await page.getByRole("button", { name: "Mark lesson complete" }).click();
    await page.getByRole("button", { name: "Mark complete" }).click();
    await expect(page.getByText("100% complete")).toBeVisible();
    await expect(
      page
        .getByRole("complementary", { name: "Study plan companion" })
        .getByText("Task complete"),
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
    await signIn(page, "fiona.harris@student.test");
    await expect(page.getByText(/Review ·/).first()).toBeVisible({
      timeout: 30_000,
    });

    const { data: task, error: taskError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select(
        "id, title, target_units, section_id, question_stem_category_id, launch_config",
      )
      .eq("student_id", studentId)
      .eq("task_type", "practice")
      .order("scheduled_date")
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (taskError) throw taskError;
    if (
      !task?.section_id ||
      !task.question_stem_category_id ||
      !task.target_units
    ) {
      throw new Error("Fiona has no actionable category practice task.");
    }
    const launchConfig = task.launch_config as { section?: string } | null;
    if (!launchConfig?.section)
      throw new Error("Practice fixture is missing its section key.");
    const completedQuestions = Math.max(1, task.target_units - 1);
    const sessionId = randomUUID();
    const completedAt = new Date().toISOString();
    const { error: sessionError } = await admin
      .from("student_practice_sessions")
      .insert({
        id: sessionId,
        student_id: studentId,
        ucat_section_id: task.section_id,
        section_key: launchConfig.section,
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
    const practiceTask = page
      .locator("li")
      .filter({ hasText: task.title })
      .first();
    await expect(practiceTask.getByText(task.title)).toHaveClass(
      /line-through/,
    );
    const reviewTitle = `Review · ${task.title}`;
    const reviewTask = page
      .locator("li")
      .filter({ hasText: reviewTitle })
      .first();
    const reviewCompletion = page.waitForResponse(
      (response) =>
        response.url().includes("/api/ucat/study-plan/tasks/") &&
        response.request().method() === "PATCH" &&
        response.request().postData()?.includes('"action":"complete"') ===
          true &&
        response.ok(),
    );
    await reviewTask.getByRole("button", { name: "Review now" }).click();
    await page.waitForURL(
      (url) => url.pathname === `/progress/practice-sessions/${sessionId}`,
    );
    await expect(page.getByText(/Attempt from /)).toBeVisible({
      timeout: 15_000,
    });
    await reviewCompletion;

    await page.goto("/study-plan");
    const completedReview = page
      .locator("li")
      .filter({ hasText: reviewTitle })
      .first();
    await expect(completedReview.getByText(reviewTitle)).toHaveClass(
      /line-through/,
    );
  });

  test("keeps the companion collapsed with live progress during ordinary practice", async ({
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
    const { error: accessError } = await admin
      .from("students")
      .update({ ucat_online_tier_override: "force_unlimited" })
      .eq("id", studentId);
    if (accessError) throw accessError;

    await signIn(page, "fiona.harris@student.test");
    await expect(page.getByText(/Review ·/).first()).toBeVisible({
      timeout: 30_000,
    });
    const { data: task, error: taskError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("id, title")
      .eq("student_id", studentId)
      .eq("task_type", "practice")
      .order("scheduled_date")
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (taskError) throw taskError;
    if (!task?.title) throw new Error("Fiona has no planned practice task.");

    const practiceTask = page
      .locator("li")
      .filter({ hasText: task.title })
      .first();
    await practiceTask.getByRole("button", { name: "Start" }).click();
    await page.waitForURL((url) => url.pathname === "/practice/session", {
      timeout: 30_000,
    });

    const companion = page.getByRole("complementary", {
      name: "Study plan companion",
    });
    await expect(companion).toBeVisible();
    await expect(companion.getByText("Practice in progress")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      companion.getByText(task.title, { exact: true }).first(),
    ).toBeVisible();
    await expect(
      companion.getByRole("button", { name: "Study plan progress" }),
    ).toBeDisabled();
    await expect
      .poll(async () =>
        companion.evaluate((element) => getComputedStyle(element).position),
      )
      .toBe("static");
    const { data: session, error: sessionError } = await admin
      .from("student_practice_sessions")
      .select("stems_snapshot, filters_snapshot")
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
    const liveProgress = companion
      .locator("p")
      .filter({ hasText: `of ${deliveredCount} answered` })
      .first();
    await expect(liveProgress).toContainText("0");

    await page.goto("/exam/tutorial");
    await expect(
      page.getByRole("complementary", { name: "Study plan companion" }),
    ).toHaveCount(0);
  });
});
