import { syncExamAttempt } from "../exam-attempts-api";
import { QuotaExceededError } from "@/lib/ucat/quota/parse-quota-error";
import type { SyncExamAttemptInput } from "@/lib/ucat/exam-attempt/types";

const quotaPayload = {
  code: "QUOTA_EXCEEDED" as const,
  area: "practice" as const,
  used: 11,
  limit: 10,
  period: "day" as const,
};

const syncInput: SyncExamAttemptInput = {
  kind: "practice",
  attemptId: "practice-session-1",
  engineSnapshot: {
    phase: "question",
    instructionsIndex: 0,
    showReadyDialog: false,
    showTimeExpiredDialog: false,
    nextSegmentTimerStartedAt: null,
    currentIndex: 0,
    visitedQuestionIds: ["question-1"],
    flaggedIds: [],
    selectedAnswers: {},
    placementSnapshots: {},
    reviewFilter: null,
    reviewFilterIndex: 0,
    reviewFilterIndicesSnapshot: null,
    viewingQuestionIndex: null,
  },
  currentSegmentEndsAt: null,
  questionActiveTiming: {
    questionId: "question-1",
    questionSetId: "stem-1",
    mode: "questionStem",
    wasTimed: false,
  },
};

describe("syncExamAttempt", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function response(status: number, body: unknown): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: jest.fn(async () => body),
    } as unknown as Response;
  }

  it("surfaces a practice quota 403 as QuotaExceededError instead of a generic sync failure", async () => {
    global.fetch = jest.fn(async () => response(403, quotaPayload));

    const error = await syncExamAttempt(syncInput).then(
      () => {
        throw new Error("expected a quota rejection");
      },
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(QuotaExceededError);
    expect(error).toEqual(
      expect.objectContaining({
        name: "QuotaExceededError",
        payload: quotaPayload,
      }),
    );
  });

  it("still reports unexpected sync failures", async () => {
    global.fetch = jest.fn(async () =>
      response(500, { error: "Failed to persist snapshot" }),
    );

    await expect(syncExamAttempt(syncInput)).rejects.toThrow(
      "Failed to persist snapshot",
    );
  });
});
