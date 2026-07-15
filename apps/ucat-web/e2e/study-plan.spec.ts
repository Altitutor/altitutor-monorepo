import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const password = "test-password";

function localAdmin() {
  const url = process.env.UCAT_E2E_SUPABASE_URL;
  const key = process.env.UCAT_E2E_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("The local Supabase E2E environment is unavailable.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function signIn(page: Page, email: string) {
  page.on("response", async (response) => {
    if (response.url().includes("/api/ucat/study-plan") && !response.ok()) {
      console.error("Study plan API failure:", response.status(), await response.text());
    }
  });
  await page.goto("/login?redirect=/study-plan");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/study-plan");
  await expect(page.getByRole("heading", { name: "Study plan" })).toBeVisible({ timeout: 30_000 });
}

test.describe("personalised Study plan", () => {
  test("generates category practice, warm-ups, and linked review tasks", async ({ page }) => {
    await signIn(page, "alice.williams@student.test");

    await expect(page.getByText("Your plan to test day")).toBeVisible();
    await expect(page.getByText("2100", { exact: true })).toBeVisible();
    await expect(page.getByText(/Warm up ·/).first()).toBeVisible();
    await expect(page.getByText(/Review ·/).first()).toBeVisible();
    await expect(page.getByText(/Reading Comprehension|True, False, Can't Tell/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Finish attempt first" }).first()).toBeDisabled();
    await expect(page.getByText(/Full mock \d+/)).toHaveCount(0);
  });

  test("warns but still generates a plan for constrained availability", async ({ page }) => {
    await signIn(page, "bob.taylor@student.test");

    await expect(page.getByText("There is a capacity gap")).toBeVisible();
    await expect(page.getByText("This is guidance, not a block.")).toBeVisible();
    await expect(page.getByText("Your plan to test day")).toBeVisible();
  });

  test("unlocks a mock only for the persona with completed cognitive section sets", async ({ page }) => {
    await signIn(page, "charlie.martinez@student.test");

    await expect(page.getByText(/Full mock \d+/).first()).toBeVisible();
  });

  test("marks a learning task complete after completing the lesson", async ({ page }) => {
    const admin = localAdmin();
    const studentId = "10000000-0000-0000-0000-000000000004";
    const moduleId = "f2000000-0000-4000-8000-000000000001";
    const { error: progressError } = await admin
      .from("ucat_student_learning_module_progress")
      .upsert({
        student_id: studentId,
        learning_module_id: moduleId,
        completion_percent: 50,
        completed_at: null,
      }, { onConflict: "student_id,learning_module_id" });
    if (progressError) throw progressError;
    const { error: generationError } = await admin
      .from("ucat_student_study_plan_generations")
      .delete()
      .eq("student_id", studentId);
    if (generationError) throw generationError;

    await signIn(page, "diana.garcia@student.test");
    const title = "Reading comprehension foundations";
    const task = page.locator("li").filter({ hasText: title }).first();
    await expect(task).toContainText("In progress");
    await task.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(new RegExp(`/learn/${moduleId}`));
    await page.getByRole("button", { name: "Mark lesson complete" }).click();
    await page.getByRole("button", { name: "Mark complete" }).click();
    await expect(page.getByText("100% complete")).toBeVisible();

    await page.goto("/study-plan");
    const completedTask = page.locator("li").filter({ hasText: title }).first();
    await expect(completedTask.getByText(title)).toHaveClass(/line-through/);
    await expect(completedTask.getByRole("button", { name: "Continue" })).toHaveCount(0);
  });

  test("reconciles category-matched practice and completes its linked review", async ({ page }) => {
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
    await expect(page.getByText(/Review ·/).first()).toBeVisible({ timeout: 30_000 });

    const { data: task, error: taskError } = await admin
      .from("ucat_student_study_plan_tasks")
      .select("id, title, target_units, section_id, question_stem_category_id, launch_config")
      .eq("student_id", studentId)
      .eq("task_type", "practice")
      .order("scheduled_date")
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (taskError) throw taskError;
    if (!task?.section_id || !task.question_stem_category_id || !task.target_units) {
      throw new Error("Fiona has no actionable category practice task.");
    }
    const launchConfig = task.launch_config as { section?: string } | null;
    if (!launchConfig?.section) throw new Error("Practice fixture is missing its section key.");
    const completedQuestions = Math.ceil(task.target_units * 0.85);
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

    await page.reload();
    const practiceTask = page.locator("li").filter({ hasText: task.title }).first();
    await expect(practiceTask.getByText(task.title)).toHaveClass(/line-through/);
    const reviewTitle = `Review · ${task.title}`;
    const reviewTask = page.locator("li").filter({ hasText: reviewTitle }).first();
    const reviewCompletion = page.waitForResponse((response) =>
      response.url().includes("/api/ucat/study-plan/tasks/") &&
      response.request().method() === "PATCH" &&
      response.request().postData()?.includes('"action":"complete"') === true &&
      response.ok()
    );
    await reviewTask.getByRole("button", { name: "Review now" }).click();
    await page.waitForURL((url) => url.pathname === `/progress/practice-sessions/${sessionId}`);
    await expect(page.getByText(/Attempt from /)).toBeVisible({ timeout: 15_000 });
    await reviewCompletion;

    await page.goto("/study-plan");
    const completedReview = page.locator("li").filter({ hasText: reviewTitle }).first();
    await expect(completedReview.getByText(reviewTitle)).toHaveClass(/line-through/);
  });
});
