import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { expect, test as base, type Page } from "@playwright/test";

const test = base.extend<{ teachingSessionId: string }>({
  teachingSessionId: async ({ baseURL }, provideSession) => {
    const url = process.env.TUTOR_E2E_SUPABASE_URL;
    const key = process.env.TUTOR_E2E_SERVICE_ROLE_KEY;
    const ownedLocal = Boolean(process.env.ALTITUTOR_WORKTREE_DEV_MANIFEST) ||
      (process.env.ALTITUTOR_OWNED_DB_INNER === "1" && Boolean(process.env.ALTITUTOR_TEST_DB_MANIFEST));
    const hostedCI = process.platform === "linux" &&
      process.env.GITHUB_ACTIONS === "true" && process.env.RUNNER_ENVIRONMENT === "github-hosted";
    if ((!ownedLocal && !hostedCI) || !url || !key || !baseURL ||
      !["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
      !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) {
      throw new Error("Teaching fixtures require owned local Supabase and a local web server");
    }
    const database = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const classId = "20000000-0000-0000-0000-000000000001";
    const { data: offering, error } = await database.from("classes")
      .select("subject_id").eq("id", classId).single();
    if (error) throw error;
    const id = randomUUID();
    const start = Date.now() - 86_400_000;
    try {
      await database.from("sessions").insert({
        id, class_id: classId, subject_id: offering.subject_id, type: "CLASS",
        start_at: new Date(start).toISOString(),
        end_at: new Date(start + 3_600_000).toISOString(), status: "ACTIVE",
      }).throwOnError();
      await database.from("sessions_staff").insert({
        id: randomUUID(), session_id: id,
        staff_id: "00000000-0000-0000-0000-000000000010", type: "MAIN_TUTOR",
        created_by: "00000000-0000-0000-0000-000000000001",
      }).throwOnError();
      await database.from("sessions_students").insert({
        id: randomUUID(), session_id: id,
        student_id: "10000000-0000-0000-0000-000000000001",
        created_by: "00000000-0000-0000-0000-000000000001",
      }).throwOnError();
      await provideSession(id);
    } finally {
      // Retain log/note history; only this test's session leaves active scheduling.
      await database.from("sessions").update({ status: "INACTIVE" })
        .eq("id", id).throwOnError();
    }
  },
});

async function signIn(page: Page) {
  await page.goto("/login?next=/classes");
  await page.getByLabel("Email").fill("john.doe@altitutor.test");
  await page.getByPlaceholder("Enter your password").fill("test-password");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/classes", {
    timeout: 20_000,
  });
}

test("a submitted Tutor log retains attendance, topics and notes after reload", async ({
  page, teachingSessionId,
}) => {
  await signIn(page);
  const sessionUrl = `/classes?session=${teachingSessionId}`;
  await page.goto(sessionUrl);
  const details = page.getByRole("dialog", { name: "Session Details" });
  await details.getByRole("button", { name: "Add Tutor Log" }).click();
  const log = page.getByRole("dialog", { name: "Tutor log", exact: true });
  await expect(log.getByText("John Doe", { exact: true })).toBeVisible();
  await log.getByRole("button", { name: "Attended", exact: true }).click();
  await log.getByRole("button", { name: "Next", exact: true }).click();
  await expect(log.getByText("Alice Williams", { exact: true })).toBeVisible();
  await log.getByRole("button", { name: "Attended", exact: true }).click();
  await log.getByRole("button", { name: "Next", exact: true }).click();
  await log.getByRole("button", { name: /Calculus/ }).click();
  await log.getByRole("button", { name: "Next", exact: true }).click();
  await expect(log.getByRole("button", { name: "Remove Alice Williams" })).toBeVisible();
  // No files were used; navigate the optional file and file-student steps.
  for (let step = 0; step < 3; step += 1) {
    await log.getByRole("button", { name: "Next", exact: true }).click();
  }
  const note = "Reviewed derivatives and agreed the next practice task.";
  await log.getByPlaceholder("Add session notes...").fill(note);
  await log.getByRole("button", { name: "Next", exact: true }).click();
  await expect(log.getByText(note, { exact: true })).toBeVisible();
  await log.getByRole("button", { name: "Submit Log", exact: true }).click();
  await expect(log.getByText("Tutor Log Submitted Successfully!")).toBeVisible();
  await log.getByRole("button", { name: "Close", exact: true }).click();

  await page.goto(sessionUrl);
  await expect(details.getByText(note, { exact: true })).toBeVisible();
  await expect(details.getByText("2 Calculus", { exact: true })).toBeVisible();
  const alice = details.getByRole("row").filter({ hasText: "Alice Williams" });
  await expect(alice).toContainText("Attended");
  await expect(details.getByRole("button", { name: "Add Tutor Log" })).toHaveCount(0);
});

test("shared rich-text formatting and a posted session note survive reload", async ({
  page, teachingSessionId,
}) => {
  await signIn(page);
  const sessionUrl = `/classes?session=${teachingSessionId}`;
  await page.goto(sessionUrl);
  const details = page.getByRole("dialog", { name: "Session Details" });
  const editor = details.locator('[contenteditable="true"]');
  const note = "Remember to explain the reasoning.";
  await editor.fill(note);
  await editor.press("ControlOrMeta+A");
  await editor.press("ControlOrMeta+B");
  const savedNote = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname === `/api/sessions/${teachingSessionId}/notes`,
  );
  await details.getByRole("button", { name: "Post note", exact: true }).click();
  expect((await savedNote).ok()).toBe(true);
  // Bold editor content is not proof of a save; the editor clears after success.
  await expect(editor).toHaveText("");
  await expect(details.locator("strong").filter({ hasText: note })).toBeVisible();

  await page.goto(sessionUrl);
  await expect(details.locator("strong").filter({ hasText: note })).toBeVisible();
  await expect(details.getByText(note, { exact: true })).toHaveCount(1);
});
