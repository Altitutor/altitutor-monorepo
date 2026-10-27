import type { InterviewRound } from "../index";
import { interviewMediaPolicy } from "../media";
import {
  InterviewMediaService,
  type InterviewMediaStore,
} from "../server/media-service";
import { DailyInterviewProvider } from "../server/daily";

const round = {
  id: "round",
  delivery: "online",
  mode: "exam",
  phase: "reading",
  pausedAt: null,
  phaseStartedAt: "2026-10-22T10:00:00Z",
  phaseDeadline: "2026-10-22T10:02:00Z",
  recordingEnabled: true,
  progress: [
    {
      stationId: "station",
      tutorId: "tutor",
      studentId: "student",
      endedEarly: false,
      feedbackComplete: false,
    },
  ],
  attempts: [{ id: "attempt", stationId: "station", studentId: "student" }],
} as InterviewRound;

describe("interview media authorisation", () => {
  it("enforces one-way exam reading at provider permission boundary", () => {
    expect(interviewMediaPolicy(round, "tutor", "tutor")).toMatchObject({
      canSend: false,
      canReceive: true,
      recordingEnabled: false,
    });
    expect(interviewMediaPolicy(round, "student", "student")).toMatchObject({
      canSend: true,
      canReceive: false,
      recordingEnabled: false,
    });
    expect(interviewMediaPolicy(round, "outsider", "student")).toBeNull();
  });
  it("cuts off only the finished exam pair and allows feedback-mode discussion", () => {
    const ended = {
      ...round,
      phase: "questions" as const,
      progress: round.progress.map((entry) => ({ ...entry, endedEarly: true })),
    };
    expect(interviewMediaPolicy(ended, "student", "student")).toBeNull();
    expect(
      interviewMediaPolicy(
        { ...ended, mode: "feedback" },
        "student",
        "student",
      ),
    ).toMatchObject({
      phase: "feedback",
      canSend: true,
      canReceive: true,
      recordingEnabled: true,
    });
    expect(
      interviewMediaPolicy(
        { ...round, pausedAt: "2026-10-22T10:01:00Z" },
        "tutor",
        "tutor",
      ),
    ).toBeNull();
  });
});

test("ticket provisioning reuses initial state but still checks authorization after provisioning", async () => {
  let current = {
    ...round,
    phaseDeadline: "2099-10-22T10:02:00Z",
    recordings: [],
  };
  const read = jest.fn(async () => current);
  const store: InterviewMediaStore = {
    round: read,
    sessions: async () => [],
    ensureSession: async (session) => ({
      ...session,
      url: "https://example.daily.co/private",
    }),
    updateSession: async () => undefined,
    claimRecordingRefresh: async () => false,
    ensureRecording: async () => undefined,
    failPendingRecording: async () => undefined,
    syncRecording: async () => undefined,
  };
  const request = jest
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ token: "scoped" })));
  const service = new InterviewMediaService(
    store,
    new DailyInterviewProvider("test", request),
  );
  expect(
    await service.ticket("round", {
      id: "tutor",
      name: "Tutor",
      role: "tutor",
    }),
  ).toMatchObject({ token: "scoped", canReceive: true });
  expect(read).toHaveBeenCalledTimes(2);
  request.mockClear();
  store.ensureSession = async (session) => {
    current = { ...current, pausedAt: "2026-10-25T00:00:00Z" };
    return { ...session, url: "https://example.daily.co/private" };
  };
  expect(
    await service.ticket("round", {
      id: "tutor",
      name: "Tutor",
      role: "tutor",
    }),
  ).toMatchObject({ sessionId: null, canSend: false, canReceive: false });
  expect(request).not.toHaveBeenCalled();
});
