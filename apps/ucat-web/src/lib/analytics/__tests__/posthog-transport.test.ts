/** @jest-environment node */

import { gunzipSync } from "node:zlib";

jest.mock("server-only", () => ({}));
jest.mock("@vercel/functions", () => ({ waitUntil: jest.fn() }));

let captureCompletion: typeof import("../posthog-server").captureUcatLearningActivityCompleted;
const received: { batch: Record<string, unknown>[] }[] = [];

beforeEach(async () => {
  received.length = 0;
  jest.replaceProperty(process, "env", {
    ...process.env,
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "phc_isolated_test",
    NEXT_PUBLIC_POSTHOG_HOST: "https://posthog.invalid",
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: "test",
  });
  // This transport contract does not need cohort lookup credentials.
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.POSTHOG_CAPTURE_MODE;
  ({ captureUcatLearningActivityCompleted: captureCompletion } = await import("../posthog-server"));
  jest.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    expect(String(url)).toBe("https://posthog.invalid/batch/");
    const bytes = Buffer.from(await new Response(init?.body).arrayBuffer());
    const text = new Headers(init?.headers).get("Content-Encoding") === "gzip"
      ? gunzipSync(bytes).toString("utf8")
      : bytes.toString("utf8");
    received.push(JSON.parse(text));
    return new Response('{"status":1}', { status: 200 });
  });
});

afterEach(() => jest.restoreAllMocks());

it("flushes the durable study completion and its deduplication key through the real SDK", async () => {
  await captureCompletion({
    userId: "student-1",
    activityType: "lesson",
    activityId: "lesson-attempt-1",
    properties: { completion_source: "lesson" },
  });

  expect(received).toEqual([
    expect.objectContaining({
      batch: [expect.objectContaining({
        event: "learning_activity_completed",
        distinct_id: "student-1",
        properties: expect.objectContaining({
          app: "ucat-web",
          product: "ucat",
          activity_type: "lesson",
          activity_id: "lesson-attempt-1",
          completion_source: "lesson",
          $insert_id: "ucat:lesson:lesson-attempt-1:completed",
        }),
      })],
    }),
  ]);
});

it("does not reject a study completion when ingestion fails", async () => {
  jest.mocked(fetch).mockRejectedValue(new Error("ingestion unavailable"));
  const errors = jest.spyOn(console, "error").mockImplementation(() => undefined);

  await expect(captureCompletion({
    userId: "student-1",
    activityType: "lesson",
    activityId: "lesson-attempt-1",
  })).resolves.toBeUndefined();
  expect(errors).toHaveBeenCalledWith(
    "[posthog] Failed to capture UCAT retention event",
    expect.any(String),
  );
});
