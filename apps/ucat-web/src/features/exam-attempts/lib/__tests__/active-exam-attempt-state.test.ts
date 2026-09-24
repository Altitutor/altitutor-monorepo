import {
  getLaunchConflictAttempt,
  resolveActiveExamAttemptFromSources,
} from "@/features/exam-attempts/lib/active-exam-attempt-state";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";

function attempt(
  overrides: Partial<ActiveExamAttempt> &
    Pick<ActiveExamAttempt, "kind" | "attemptId" | "resourceId">,
): ActiveExamAttempt {
  return {
    label: "Study plan golden mock 2",
    resumeHref: "/exam",
    resultsHref: `/progress/mocks/mock-attempts/${overrides.attemptId}`,
    currentSegmentEndsAt: null,
    engineSnapshot: { phase: "question" } as ActiveExamAttempt["engineSnapshot"],
    mockAttemptId: null,
    setAttemptIdsBySetId: {},
    practiceSessionId: null,
    wasTimed: true,
    ...overrides,
  };
}

describe("resolveActiveExamAttemptFromSources", () => {
  const local = attempt({
    kind: "mock",
    attemptId: "local-1",
    resourceId: "mock-1",
  });
  const completed = attempt({
    kind: "mock",
    attemptId: "completed-1",
    resourceId: "mock-1",
    engineSnapshot: {
      phase: "mockScore",
    } as ActiveExamAttempt["engineSnapshot"],
  });

  it("lets a successful server null clear stale local and completed notice", () => {
    expect(
      resolveActiveExamAttemptFromSources({
        queryData: null,
        localActive: local,
        completedNotice: completed,
      }),
    ).toBeNull();
  });

  it("falls back to local state only while the query is unresolved", () => {
    expect(
      resolveActiveExamAttemptFromSources({
        queryData: undefined,
        localActive: local,
        completedNotice: completed,
      }),
    ).toBe(local);
  });

  it("uses the server attempt when present", () => {
    const server = attempt({
      kind: "set",
      attemptId: "server-1",
      resourceId: "set-1",
    });
    expect(
      resolveActiveExamAttemptFromSources({
        queryData: server,
        localActive: local,
        completedNotice: completed,
      }),
    ).toBe(server);
  });
});

describe("getLaunchConflictAttempt", () => {
  it("ignores results-phase attempts so finished mocks do not block launch", () => {
    const finished = attempt({
      kind: "mock",
      attemptId: "mock-attempt-1",
      resourceId: "mock-1",
      engineSnapshot: {
        phase: "mockScore",
      } as ActiveExamAttempt["engineSnapshot"],
    });

    expect(getLaunchConflictAttempt(finished, "set", "set-1")).toBeNull();
  });

  it("returns a different in-progress attempt as a conflict", () => {
    const active = attempt({
      kind: "mock",
      attemptId: "mock-attempt-1",
      resourceId: "mock-1",
    });

    expect(getLaunchConflictAttempt(active, "set", "set-1")).toBe(active);
  });

  it("allows launching the same in-progress resource", () => {
    const active = attempt({
      kind: "mock",
      attemptId: "mock-attempt-1",
      resourceId: "mock-1",
    });

    expect(getLaunchConflictAttempt(active, "mock", "mock-1")).toBeNull();
  });
});
