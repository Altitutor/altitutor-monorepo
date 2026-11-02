/** @jest-environment node */

import { gunzipSync } from "node:zlib";
import { captureInPersonBookingEventInBackground } from "../posthog-server";

const pending: Promise<unknown>[] = [];
jest.mock("server-only", () => ({}));
jest.mock("@vercel/functions", () => ({
  waitUntil: (promise: Promise<unknown>) => pending.push(promise),
}));

type Ingestion = { api_key: string; batch: Record<string, unknown>[] };
const received: Ingestion[] = [];

beforeEach(() => {
  pending.length = 0;
  received.length = 0;
  jest.replaceProperty(process, "env", {
    ...process.env,
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "phc_isolated_test",
    NEXT_PUBLIC_POSTHOG_HOST: "https://posthog.invalid",
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: "test",
  });
  delete process.env.POSTHOG_CAPTURE_MODE;
  jest.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    expect(String(url)).toBe("https://posthog.invalid/batch/");
    const bytes = Buffer.from(await new Response(init?.body).arrayBuffer());
    const text = new Headers(init?.headers).get("Content-Encoding") === "gzip"
      ? gunzipSync(bytes).toString("utf8")
      : bytes.toString("utf8");
    received.push(JSON.parse(text) as Ingestion);
    return new Response('{"status":1}', { status: 200 });
  });
});

afterEach(() => jest.restoreAllMocks());

it("flushes a completed booking through the real SDK before background work finishes", async () => {
  captureInPersonBookingEventInBackground({
    event: "booking_completed",
    distinctId: "anon-booking",
    sessionId: "session-1",
    sessionType: "TRIAL_SESSION",
    studentId: "student-1",
    posthogSessionId: "browser-session-1",
  });

  await Promise.all(pending);

  expect(received).toEqual([
    expect.objectContaining({
      api_key: "phc_isolated_test",
      batch: [expect.objectContaining({
        event: "booking_completed",
        distinct_id: "anon-booking",
        properties: expect.objectContaining({
          app: "student-web",
          product: "in-person",
          journey: "in_person_enrollment",
          surface: "booking",
          environment: "test",
          session_id: "session-1",
          session_type: "TRIAL_SESSION",
          student_id: "student-1",
          $session_id: "browser-session-1",
          $insert_id: "in-person:booking_completed:session-1",
        }),
      })],
    }),
  ]);
});

it("settles background booking analytics when ingestion is unavailable", async () => {
  jest.mocked(fetch).mockRejectedValue(new Error("ingestion unavailable"));
  const errors = jest.spyOn(console, "error").mockImplementation(() => undefined);

  captureInPersonBookingEventInBackground({
    event: "booking_completed",
    distinctId: "anon-booking",
    sessionId: "session-1",
    sessionType: "TRIAL_SESSION",
  });

  await expect(Promise.all(pending)).resolves.toEqual([undefined]);
  expect(errors).toHaveBeenCalledWith(
    "[posthog] Failed to capture in-person booking event",
    expect.any(String),
  );
});

it("makes no ingestion request when booking analytics is not configured", async () => {
  delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

  captureInPersonBookingEventInBackground({
    event: "booking_completed",
    distinctId: "anon-booking",
    sessionId: "session-1",
    sessionType: "TRIAL_SESSION",
  });

  await Promise.all(pending);
  expect(fetch).not.toHaveBeenCalled();
});
