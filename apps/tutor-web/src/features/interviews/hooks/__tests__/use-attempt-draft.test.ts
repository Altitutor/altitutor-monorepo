import { act, renderHook } from "@testing-library/react";
import type {
  InterviewStationAttempt,
  InterviewCommand,
} from "@altitutor/shared";
import { useAttemptDraft } from "../use-attempt-draft";
import { sendInterviewCommand } from "../../api/interviews";

jest.mock("../../api/interviews", () => ({ sendInterviewCommand: jest.fn() }));
const send = jest.mocked(sendInterviewCommand);
const attempt: InterviewStationAttempt = {
  id: "attempt",
  studentId: "student",
  stationId: "station",
  version: 1,
  score: null,
  notAssessedReason: null,
  feedback: [],
  completed: false,
  updatedAt: "",
  updatedBy: null,
};
beforeEach(() => {
  send.mockReset();
  sessionStorage.clear();
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: jest
      .fn()
      .mockReturnValueOnce("first-command")
      .mockReturnValue("second-command"),
  });
});

test("retry after a lost response uses the same command identity and retains the feedback", async () => {
  send
    .mockRejectedValueOnce(new Error("Connection lost"))
    .mockResolvedValueOnce({ id: "attempt", version: 2 });
  const { result } = renderHook(() => useAttemptDraft("round", attempt));
  act(() =>
    result.current.update({
      score: 4.5,
      notAssessedReason: null,
      generalFeedback: null,
      feedback: [{ placementId: "question", value: "Clear reasoning" }],
    }),
  );
  await act(async () => {
    await expect(result.current.flush()).rejects.toThrow("Connection lost");
  });
  expect(result.current.draft.feedback[0].value).toBe("Clear reasoning");
  expect(result.current.state).toBe("failed");
  await act(async () => {
    await result.current.flush();
  });
  const calls = send.mock.calls.map(
    ([command]) =>
      command as Extract<InterviewCommand, { type: "saveAttempt" }>,
  );
  expect(calls[1].commandId).toBe(calls[0].commandId);
  expect(calls[1].expectedAttemptVersion).toBe(1);
  expect(result.current.state).toBe("saved");
});

test("a save acknowledgement never replaces feedback typed while the request was in flight", async () => {
  let finishFirst!: (value: { id: string; version: number }) => void;
  send
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
    )
    .mockResolvedValueOnce({ id: "attempt", version: 3 });
  const { result } = renderHook(() => useAttemptDraft("round", attempt));
  act(() =>
    result.current.update({
      score: 3,
      notAssessedReason: null,
      generalFeedback: null,
      feedback: [{ placementId: "question", value: "First note" }],
    }),
  );
  let saving!: Promise<void>;
  act(() => {
    saving = result.current.flush();
  });
  act(() =>
    result.current.update({
      score: 4,
      notAssessedReason: null,
      generalFeedback: null,
      feedback: [{ placementId: "question", value: "More detailed note" }],
    }),
  );
  await act(async () => {
    finishFirst({ id: "attempt", version: 2 });
    await saving;
  });
  expect(send).toHaveBeenLastCalledWith(
    expect.objectContaining({
      expectedAttemptVersion: 2,
      score: 4,
      feedback: [{ placementId: "question", value: "More detailed note" }],
    }),
  );
  expect(result.current.draft.feedback[0].value).toBe("More detailed note");
  expect(result.current.state).toBe("saved");
});

test("a newer server revision leaves the local draft intact until the tutor resolves the conflict", () => {
  const { result, rerender } = renderHook(
    ({ serverAttempt }) => useAttemptDraft("round", serverAttempt),
    { initialProps: { serverAttempt: attempt } },
  );
  act(() =>
    result.current.update({
      score: 4.5,
      notAssessedReason: null,
      generalFeedback: null,
      feedback: [{ placementId: "question", value: "Local note" }],
    }),
  );
  rerender({
    serverAttempt: {
      ...attempt,
      version: 2,
      score: 2,
      feedback: [{ placementId: "question", value: "Other saved note" }],
    },
  });
  expect(result.current.draft.feedback[0].value).toBe("Local note");
  expect(result.current.newerRevision).toBe(true);
  act(() => result.current.loadSaved());
  expect(result.current.draft.feedback[0].value).toBe("Other saved note");
  expect(result.current.state).toBe("saved");
});

test("a rejected invalid score can be corrected without retrying the rejected payload forever", async () => {
  send
    .mockRejectedValueOnce(
      Object.assign(new Error("Score exceeds maximum"), { status: 400 }),
    )
    .mockResolvedValueOnce({ id: "attempt", version: 2 });
  const { result } = renderHook(() => useAttemptDraft("round", attempt));
  act(() =>
    result.current.update({
      score: 8,
      notAssessedReason: null,
      generalFeedback: null,
      feedback: [],
    }),
  );
  await act(async () => {
    await expect(result.current.flush()).rejects.toThrow(
      "Score exceeds maximum",
    );
  });
  act(() =>
    result.current.update({
      score: 5,
      notAssessedReason: null,
      generalFeedback: null,
      feedback: [],
    }),
  );
  await act(async () => {
    await result.current.flush();
  });
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ score: 5 }));
  expect(send).toHaveBeenCalledTimes(2);
});

test("restoring a draft against a newer saved revision requires an explicit conflict decision", () => {
  sessionStorage.setItem(
    "interview-draft:round:attempt",
    JSON.stringify({
      version: 1,
      draft: {
        score: 4,
        notAssessedReason: null,
        generalFeedback: null,
        feedback: [{ placementId: "question", value: "Recovered note" }],
      },
    }),
  );
  const { result } = renderHook(() =>
    useAttemptDraft("round", { ...attempt, version: 2, score: 2 }),
  );
  expect(result.current.draft.feedback[0].value).toBe("Recovered note");
  expect(result.current.newerRevision).toBe(true);
  expect(result.current.state).toBe("failed");
  expect(send).not.toHaveBeenCalled();
});

test("general feedback survives an in-flight save and remains separate from question feedback", async () => {
  let finishFirst!: (value: { id: string; version: number }) => void;
  send
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
    )
    .mockResolvedValueOnce({ id: "attempt", version: 3 });
  const { result } = renderHook(() => useAttemptDraft("round", attempt));
  expect(result.current.draft.generalFeedback).toBeNull();
  act(() =>
    result.current.update({
      ...result.current.draft,
      generalFeedback: "Strong empathy overall",
    }),
  );
  let saving!: Promise<void>;
  act(() => {
    saving = result.current.flush();
  });
  act(() =>
    result.current.update({
      ...result.current.draft,
      generalFeedback: "Strong empathy; structure your summary",
      feedback: [
        { placementId: "question", value: "Explain the alternatives" },
      ],
    }),
  );
  await act(async () => {
    finishFirst({ id: "attempt", version: 2 });
    await saving;
  });
  expect(send).toHaveBeenLastCalledWith(
    expect.objectContaining({
      expectedAttemptVersion: 2,
      generalFeedback: "Strong empathy; structure your summary",
      feedback: [
        { placementId: "question", value: "Explain the alternatives" },
      ],
    }),
  );
  expect(result.current.state).toBe("saved");
});

test("recovery retains an explicit general-feedback clear rather than restoring the saved note", async () => {
  sessionStorage.setItem(
    "interview-draft:round:attempt",
    JSON.stringify({
      version: 1,
      draft: {
        score: null,
        notAssessedReason: null,
        generalFeedback: null,
        feedback: [],
      },
    }),
  );
  send.mockResolvedValue({ id: "attempt", version: 2 });
  const { result } = renderHook(() =>
    useAttemptDraft("round", {
      ...attempt,
      generalFeedback: "Saved overall note",
    }),
  );
  expect(result.current.draft.generalFeedback).toBeNull();
  await act(async () => {
    await result.current.flush();
  });
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({ generalFeedback: null }),
  );
});

test("clearing general feedback during a legacy pending-command replay sends a separate clear", async () => {
  const legacy = {
    type: "saveAttempt",
    commandId: "legacy-command",
    roundId: "round",
    attemptId: "attempt",
    expectedAttemptVersion: 1,
    score: 3,
    notAssessedReason: null,
    feedback: [],
  };
  sessionStorage.setItem(
    "interview-draft:round:attempt",
    JSON.stringify({
      version: 1,
      draft: { score: 3, notAssessedReason: null, feedback: [] },
      pendingCommand: legacy,
    }),
  );
  let acknowledge!: (value: { id: string; version: number }) => void;
  send
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          acknowledge = resolve;
        }),
    )
    .mockResolvedValueOnce({ id: "attempt", version: 3 });
  const { result } = renderHook(() =>
    useAttemptDraft("round", {
      ...attempt,
      generalFeedback: "Saved station note",
    }),
  );
  expect(result.current.draft.generalFeedback).toBe("Saved station note");
  let saving!: Promise<void>;
  act(() => {
    saving = result.current.flush();
  });
  act(() =>
    result.current.update({ ...result.current.draft, generalFeedback: null }),
  );
  await act(async () => {
    acknowledge({ id: "attempt", version: 2 });
    await saving;
  });
  expect(send).toHaveBeenCalledTimes(2);
  expect(send).toHaveBeenLastCalledWith(
    expect.objectContaining({
      expectedAttemptVersion: 2,
      generalFeedback: null,
    }),
  );
  expect(result.current.state).toBe("saved");
});
