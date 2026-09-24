/** @jest-environment node */

jest.mock("next/server", () => ({
  NextResponse: { json: jest.fn() },
}));
jest.mock("@/lib/ucat/quota/quota-service", () => ({
  checkQuotaForAction: jest.fn(),
}));
jest.mock("server-only", () => ({}));

import type { SupabaseClient } from "@supabase/supabase-js";
import { syncExamAttempt } from "@/lib/ucat/exam-attempt/service";
import type { ExamEngineSnapshot } from "@/lib/ucat/exam-attempt/types";
import { PracticeSessionEndedError } from "@/lib/ucat/practice-sessions/practice-session-ended";

function createEngineSnapshot(): ExamEngineSnapshot {
  return {
    phase: "question",
    instructionsIndex: 0,
    showReadyDialog: false,
    showTimeExpiredDialog: false,
    nextSegmentTimerStartedAt: null,
    currentIndex: 0,
    visitedQuestionIds: ["question-1"],
    flaggedIds: [],
    selectedAnswers: { "question-1": "option-1" },
    placementSnapshots: {},
    reviewFilter: null,
    reviewFilterIndex: 0,
    reviewFilterIndicesSnapshot: null,
    viewingQuestionIndex: null,
  };
}

function createPracticeSessionAdmin(row: {
  completed_at: string | null;
  discarded_at: string | null;
  expired_at: string | null;
}) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn(async () => ({
      data: {
        ...row,
        engine_snapshot: null,
        current_segment_ends_at: null,
      },
      error: null,
    })),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return {
    from: jest.fn(() => query),
  } as unknown as SupabaseClient;
}

function syncCompletedPractice(admin: SupabaseClient) {
  return syncExamAttempt(admin, "student-1", {
    kind: "practice",
    attemptId: "practice-session-1",
    engineSnapshot: createEngineSnapshot(),
    currentSegmentEndsAt: null,
  });
}

describe("syncExamAttempt after a practice session is no longer in progress", () => {
  it("does not treat this tab's completed session as ended-elsewhere", async () => {
    const admin = createPracticeSessionAdmin({
      completed_at: "2026-08-13T11:00:00.000Z",
      discarded_at: null,
      expired_at: null,
    });

    await expect(syncCompletedPractice(admin)).resolves.toEqual({
      currentSegmentEndsAt: null,
      setAttemptIdsBySetId: {},
    });
  });

  it("still reports a discarded or expired session as ended elsewhere", async () => {
    const discarded = createPracticeSessionAdmin({
      completed_at: null,
      discarded_at: "2026-08-13T11:00:00.000Z",
      expired_at: null,
    });
    await expect(syncCompletedPractice(discarded)).rejects.toBeInstanceOf(
      PracticeSessionEndedError,
    );

    const expired = createPracticeSessionAdmin({
      completed_at: null,
      discarded_at: null,
      expired_at: "2026-08-13T11:00:00.000Z",
    });
    await expect(syncCompletedPractice(expired)).rejects.toBeInstanceOf(
      PracticeSessionEndedError,
    );
  });

  it("still reports a missing session as ended elsewhere", async () => {
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      maybeSingle: jest.fn(async () => ({ data: null, error: null })),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    const admin = {
      from: jest.fn(() => query),
    } as unknown as SupabaseClient;

    await expect(syncCompletedPractice(admin)).rejects.toBeInstanceOf(
      PracticeSessionEndedError,
    );
  });

  it("no-ops when a snapshot write loses the race to this tab completing", async () => {
    const inProgressRow = {
      completed_at: null,
      discarded_at: null,
      expired_at: null,
      engine_snapshot: null,
      current_segment_ends_at: null,
    };
    const completedRow = {
      ...inProgressRow,
      completed_at: "2026-08-13T11:00:00.000Z",
    };
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      is: jest.fn(),
      update: jest.fn(),
      maybeSingle: jest
        .fn()
        .mockResolvedValueOnce({ data: inProgressRow, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: completedRow, error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.is.mockReturnValue(query);
    query.update.mockReturnValue(query);
    const admin = {
      from: jest.fn(() => query),
    } as unknown as SupabaseClient;

    await expect(syncCompletedPractice(admin)).resolves.toEqual({
      currentSegmentEndsAt: null,
      setAttemptIdsBySetId: {},
    });
  });
});
