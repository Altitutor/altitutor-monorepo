const mockWaitUntil = jest.fn();
const mockCapture = jest.fn();
const mockFlush = jest.fn().mockResolvedValue(undefined);
const mockPostHog = jest.fn((_token: unknown, _options?: unknown) => ({
  capture: mockCapture,
  flush: mockFlush,
}));

jest.mock("server-only", () => ({}));
jest.mock("@vercel/functions", () => ({
  waitUntil: (promise: Promise<unknown>) => mockWaitUntil(promise),
}));
jest.mock("posthog-node", () => ({
  PostHog: function PostHog(...args: unknown[]) {
    return mockPostHog(args[0], args[1]);
  },
}));

import { captureUcatLearningActivityCompletedInBackground } from "@/lib/analytics/posthog-server";

describe("background UCAT completion analytics", () => {
  const originalToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "test-token";
  });

  afterAll(() => {
    if (originalToken === undefined) {
      delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    } else {
      process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = originalToken;
    }
  });

  it("registers a bounded PostHog flush with the request lifetime", async () => {
    captureUcatLearningActivityCompletedInBackground({
      userId: "user-1",
      activityType: "mock",
      activityId: "mock-1",
    });

    expect(mockPostHog).toHaveBeenCalledWith(
      "test-token",
      expect.objectContaining({
        requestTimeout: 2_000,
        fetchRetryCount: 0,
      }),
    );
    expect(mockWaitUntil).toHaveBeenCalledTimes(1);
    await mockWaitUntil.mock.calls[0][0];
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockFlush).toHaveBeenCalledTimes(1);
  });
});
