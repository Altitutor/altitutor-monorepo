import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database } from "@altitutor/shared";
import type { AdminInterviewObserverState } from "../src/features/interviews/types/observer";

test("Admin observer keeps live progress fresh while reusing unchanged station content", async ({
  page,
  baseURL,
}) => {
  const url = process.env.ADMIN_E2E_SUPABASE_URL;
  const key = process.env.ADMIN_E2E_SERVICE_ROLE_KEY;
  const owned =
    Boolean(process.env.ALTITUTOR_WORKTREE_DEV_MANIFEST) ||
    (process.env.ALTITUTOR_OWNED_DB_INNER === "1" &&
      Boolean(process.env.ALTITUTOR_TEST_DB_MANIFEST));
  const hostedCI =
    process.platform === "linux" &&
    process.env.GITHUB_ACTIONS === "true" &&
    process.env.RUNNER_ENVIRONMENT === "github-hosted";
  if (
    (!owned && !hostedCI) ||
    !url ||
    !key ||
    !baseURL ||
    !["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
    !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)
  )
    throw new Error(
      "Observer fixtures require an owned local database and local web server",
    );
  const db = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const categoryId = randomUUID(),
    bankId = randomUUID(),
    questionId = randomUUID(),
    interviewId = randomUUID();
  const roundId = randomUUID(),
    stationId = randomUUID(),
    placementId = randomUUID(),
    attemptId = randomUUID();
  const studentId = "10000000-0000-0000-0000-000000000001",
    tutorId = "00000000-0000-0000-0000-000000000010";
  const data = {
    name: "Observer browser fixture",
    delivery: "in_person",
    mode: "exam",
    recordingEnabled: true,
    phase: "questions",
    phaseStartedAt: new Date().toISOString(),
    phaseDeadline: new Date(Date.now() + 180_000).toISOString(),
    startedAt: new Date(Date.now() - 60_000).toISOString(),
    rotation: 0,
    pausedAt: null,
    remainingMilliseconds: null,
    readingTimeSeconds: 60,
    questionTimeSeconds: 180,
    students: [{ id: studentId, name: "Observer Student" }],
    tutors: [{ id: tutorId, name: "Observer Tutor" }],
    stations: [
      {
        id: stationId,
        name: "Motivation",
        prompt: "Frozen reading prompt",
        maximumPoints: 6,
        questions: [
          {
            id: placementId,
            questionId,
            question: "Frozen question wording",
            rubric: "Snapshot guidance",
            rubricVersion: 1,
          },
        ],
      },
    ],
    progress: [
      {
        stationId,
        tutorId,
        studentId,
        ready: true,
        endedEarly: false,
        feedbackComplete: false,
      },
    ],
    attempts: [
      {
        id: attemptId,
        stationId,
        studentId,
        score: 4,
        notAssessedReason: null,
        feedback: [{ placementId, value: "Thoughtful answer" }],
        generalFeedback: "Strong reflection",
      },
    ],
  };
  const path = `/api/interviews/rounds/${roundId}`;
  const reads: AdminInterviewObserverState[] = [];
  let legacyReads = 0;
  page.on("response", async (response) => {
    const requested = new URL(response.url());
    if (requested.pathname !== path) return;
    if (requested.searchParams.get("observer") !== "1") {
      legacyReads++;
      return;
    }
    if (response.ok())
      reads.push((await response.json()) as AdminInterviewObserverState);
  });
  try {
    await db
      .from("interview_categories")
      .insert({ id: categoryId, name: "Observer fixture" })
      .throwOnError();
    await db
      .from("interview_stations")
      .insert({
        id: bankId,
        name: "Motivation",
        category_id: categoryId,
        prompt: "Bank prompt",
        maximum_points: 6,
      })
      .throwOnError();
    await db
      .from("interview_questions")
      .insert({
        id: questionId,
        station_id: bankId,
        position: 0,
        tag_ids: [],
        question: "Bank question wording",
        rubric: "Current guidance",
        rubric_version: 2,
        suggested_time_seconds: 60,
      })
      .throwOnError();
    await db
      .from("interviews")
      .insert({ id: interviewId, data: {} })
      .throwOnError();
    await db
      .from("interview_rounds")
      .insert({
        id: roundId,
        interview_id: interviewId,
        created_by: tutorId,
        tutor_ids: [tutorId],
        student_ids: [studentId],
        data,
      })
      .throwOnError();
    expect((await page.request.get(`${path}?observer=1`)).status()).toBe(401);
    await page.goto("/login");
    await page
      .getByLabel("Email", { exact: true })
      .fill("admin@altitutor.test");
    await page.getByPlaceholder("Enter your password").fill("test-password");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard(?:\/|\?|$)/, { timeout: 30_000 });
    await page.goto(`/interviews/rounds/${roundId}`);
    await expect(page.getByRole("heading", { name: data.name })).toBeVisible();
    await page.getByRole("button", { name: /Station 1 · Motivation/ }).click();
    await expect(
      page.getByText("Frozen reading prompt", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Current guidance", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Thoughtful answer", { exact: true }),
    ).toBeVisible();
    const overviewReads = reads.filter(
      (read) => read.selectedStationId === null,
    ).length;
    await expect
      .poll(
        () =>
          reads.filter(
            (read) =>
              read.selectedStationId === stationId && read.content === null,
          ).length,
        { timeout: 10_000 },
      )
      .toBeGreaterThanOrEqual(2);
    // A selection switch leaves the breadcrumb's overview query idle. One
    // already in-flight response may finish after the selection changes.
    expect(
      reads.filter((read) => read.selectedStationId === null).length,
    ).toBeLessThanOrEqual(overviewReads + 1);
    const initial = reads.find(
      (read) => read.selectedStationId === stationId && read.content,
    );
    expect(initial?.round).not.toHaveProperty("attempts");
    expect(initial?.round.stations[0]).not.toHaveProperty("questions");
    await db
      .from("interview_questions")
      .update({
        rubric: "Corrected live guidance",
        rubric_version: 3,
        updated_at: new Date().toISOString(),
      })
      .eq("id", questionId)
      .throwOnError();
    await expect(
      page.getByText("Corrected live guidance", { exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    const corrected = reads.find(
      (read) =>
        read.content?.station.questions[0]?.rubric ===
        "Corrected live guidance",
    );
    expect(corrected?.round.version).toBe(initial?.round.version);
    expect(corrected?.contentRevision).not.toBe(initial?.contentRevision);
    await db
      .from("interview_rounds")
      .update({
        data: {
          ...data,
          pausedAt: new Date().toISOString(),
          remainingMilliseconds: 47_000,
        },
      })
      .eq("id", roundId)
      .throwOnError();
    await expect(
      page.getByRole("timer", { name: "Phase time remaining" }),
    ).toHaveText("0:47", { timeout: 10_000 });
    await expect(
      page.getByText("Frozen question wording", { exact: true }),
    ).toBeVisible();
    expect(legacyReads).toBe(0);
    await expect(
      page.getByRole("button", { name: /save|start reading|release/i }),
    ).toHaveCount(0);
  } finally {
    await page.goto("/dashboard");
    await db.from("interview_rounds").delete().eq("id", roundId).throwOnError();
    await db.from("interviews").delete().eq("id", interviewId).throwOnError();
    await db
      .from("interview_questions")
      .delete()
      .eq("id", questionId)
      .throwOnError();
    await db
      .from("interview_stations")
      .delete()
      .eq("id", bankId)
      .throwOnError();
    await db
      .from("interview_categories")
      .delete()
      .eq("id", categoryId)
      .throwOnError();
  }
});
