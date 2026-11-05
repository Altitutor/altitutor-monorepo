import type { InterviewRound } from "../index";
import { DailyInterviewProvider } from "../server/daily";
import {
  InterviewMediaService,
  type InterviewMediaStore,
  type InterviewMediaSession,
} from "../server/media-service";

const base = {
  id: "round",
  delivery: "online",
  mode: "feedback",
  phase: "questions",
  pausedAt: null,
  phaseStartedAt: "2026-11-05T10:00:00Z",
  phaseDeadline: "2026-11-05T10:05:00Z",
  recordingEnabled: true,
  recordings: [],
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
} as unknown as InterviewRound;

function fixture() {
  let round = base;
  const sessions: InterviewMediaSession[] = [];
  const capabilities: Array<{
    providerUserId: string;
    actorId: string;
    policyKey: string;
    expiresAt: string;
    sessionId: string;
  }> = [];
  const store: InterviewMediaStore = {
    round: async () => round,
    sessions: async () => sessions,
    ensureSession: async (next) => {
      const existing = sessions.find((item) => item.key === next.key);
      if (existing) return existing;
      sessions.push({ ...next, url: "https://example.daily.co/attempt" });
      return sessions[sessions.length - 1]!;
    },
    updateSession: async (id, patch) => {
      Object.assign(sessions.find((item) => item.id === id)!, patch);
    },
    claimRecordingRefresh: async () => false,
    ensureRecording: async () => undefined,
    failPendingRecording: async () => undefined,
    syncRecording: async () => undefined,
    capabilities: async (id) =>
      capabilities.filter((item) => item.sessionId === id),
    registerCapability: async (item) => {
      if (
        !capabilities.some(
          (entry) => entry.providerUserId === item.providerUserId,
        )
      )
        capabilities.push(item);
    },
    revokeCapabilities: async (ids) => {
      for (const id of ids) {
        const i = capabilities.findIndex((item) => item.providerUserId === id);
        if (i >= 0) capabilities.splice(i, 1);
      }
    },
  };
  const provider = new DailyInterviewProvider("test");
  const token = jest.spyOn(provider, "token").mockResolvedValue("token");
  const revoke = jest
    .spyOn(provider, "revokeUsers")
    .mockResolvedValue(undefined);
  const close = jest.spyOn(provider, "closeRoom").mockResolvedValue(undefined);
  const service = new InterviewMediaService(store, provider, () =>
    Date.parse("2026-11-05T10:01:00Z"),
  );
  return {
    service,
    token,
    revoke,
    close,
    sessions,
    capabilities,
    setRound: (next: InterviewRound) => {
      round = next;
    },
  };
}

it("keeps one attempt room while banning pre-pause credentials and issuing a new resume capability", async () => {
  const f = fixture();
  const first = await f.service.ticket("round", {
    id: "tutor",
    name: "Tutor",
    role: "tutor",
  });
  const firstUserId = f.token.mock.calls[0]![1];
  f.setRound({ ...base, pausedAt: "2026-11-05T10:01:00Z" });
  await f.service.reconcile("round");
  expect(f.revoke).toHaveBeenCalledWith(expect.stringMatching(/^mmi-/), [
    firstUserId,
  ]);
  expect(f.close).not.toHaveBeenCalled();
  f.setRound({
    ...base,
    phaseStartedAt: "2026-11-05T10:01:00Z",
    phaseDeadline: "2026-11-05T10:06:00Z",
  });
  const resumed = await f.service.ticket(
    "round",
    { id: "tutor", name: "Tutor", role: "tutor" },
    first.sessionId ?? undefined,
    first.accessKey,
  );
  expect(resumed.sessionId).toBe(first.sessionId);
  expect(resumed.accessKey).not.toBe(first.accessKey);
  expect(f.token.mock.calls.at(-1)?.[1]).not.toBe(firstUserId);
  expect(f.sessions).toHaveLength(1);
});

it("issues an observer receive-only capability and never lets an observer start recording", async () => {
  const f = fixture();
  const ticket = await f.service.ticketObserver(
    "round",
    { id: "admin", name: "Admin" },
    "station",
  );
  expect(ticket).toMatchObject({ canSend: false, canReceive: true });
  expect(f.token.mock.calls[0]?.[4]).toEqual({
    canSend: false,
    canReceive: true,
  });
  expect(f.token.mock.calls[0]?.[5]).toBeUndefined();
});

it("bans a token minted concurrently with pause and withholds it from the caller", async () => {
  const f = fixture();
  f.token.mockImplementation(async () => {
    f.setRound({ ...base, pausedAt: "2026-11-05T10:01:00Z" });
    return "stale-token";
  });
  expect(
    await f.service.ticket("round", {
      id: "tutor",
      name: "Tutor",
      role: "tutor",
    }),
  ).toMatchObject({ sessionId: null, canSend: false, canReceive: false });
  expect(f.revoke).toHaveBeenCalledWith(expect.any(String), [
    f.token.mock.calls[0]![1],
  ]);
  expect(f.capabilities).toHaveLength(0);
});

it("closes the attempt room before exam marking instead of keeping its recording alive", async () => {
  const f = fixture();
  await f.service.ticket("round", {
    id: "tutor",
    name: "Tutor",
    role: "tutor",
  });
  f.setRound({ ...base, mode: "exam", phase: "feedback" });
  await f.service.reconcile("round");
  expect(f.close).toHaveBeenCalledTimes(1);
});

it("does not grant an observer access to an unrelated station", async () => {
  const f = fixture();
  expect(
    await f.service.ticketObserver(
      "round",
      { id: "admin", name: "Admin" },
      "unrelated",
    ),
  ).toMatchObject({ sessionId: null, canReceive: false });
  expect(f.token).not.toHaveBeenCalled();
});
