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
  const store: InterviewMediaStore = {
    round: async () => round,
    sessions: async () => sessions.map((session) => ({ ...session })),
    ensureSession: async (next) => {
      const existing = sessions.find((item) => item.key === next.key);
      if (existing) return existing;
      sessions.push(next);
      return sessions[sessions.length - 1]!;
    },
    updateSession: async (id, patch) => {
      Object.assign(sessions.find((item) => item.id === id)!, patch);
    },
    claimRecordingRefresh: async () => false,
    failPendingRecording: async () => undefined,
    syncRecording: async () => undefined,
  };
  const provider = new DailyInterviewProvider("test");
  const token = jest.spyOn(provider, "token").mockResolvedValue("token");
  const create = jest
    .spyOn(provider, "createRoom")
    .mockImplementation(async (name) => `https://example.daily.co/${name}`);
  const close = jest.spyOn(provider, "closeRoom").mockResolvedValue(undefined);
  const service = new InterviewMediaService(store, provider, () =>
    Date.parse("2026-11-05T10:01:00Z"),
  );
  return {
    service,
    token,
    create,
    store,
    close,
    sessions,
    setRound: (next: InterviewRound) => {
      round = next;
    },
  };
}

it("deletes a paused room and issues resumed credentials for a different room", async () => {
  const f = fixture();
  const first = await f.service.ticket("round", {
    id: "tutor",
    name: "Tutor",
    role: "tutor",
  });
  const firstRoom = f.token.mock.calls[0]![0];
  f.setRound({ ...base, pausedAt: "2026-11-05T10:01:00Z" });
  await f.service.reconcile("round");
  expect(f.close).toHaveBeenCalledWith(firstRoom);
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
  expect(resumed.sessionId).not.toBe(first.sessionId);
  expect(resumed.accessKey).not.toBe(first.accessKey);
  expect(f.token.mock.calls.at(-1)?.[0]).not.toBe(firstRoom);
  expect(f.sessions).toHaveLength(2);
  expect(f.sessions.every((session) => !session.recordingEnabled)).toBe(true);
  expect(resumed.recordingEnabled).toBe(true);
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
  expect(f.token.mock.calls[0]).toHaveLength(5);
});

it("deletes the room and withholds a token minted concurrently with pause", async () => {
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
  expect(f.close).toHaveBeenCalledWith(f.token.mock.calls[0]![0]);
});

it("closes the question room before exam marking", async () => {
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


it("publishes one of two concurrent rooms and deletes only the unissued loser", async () => {
  const f = fixture();
  let startFirst!: () => void;
  let completeFirst!: () => void;
  const provisioning = new Promise<void>((resolve) => { startFirst = resolve; });
  f.create.mockImplementationOnce((name) => new Promise((resolve) => {
    completeFirst = () => resolve(`https://example.daily.co/${name}`);
    startFirst();
  }));
  const first = f.service.ticket("round", {
    id: "student", name: "Student", role: "student",
  });
  await Promise.race([provisioning, first]);
  const second = await f.service.ticket("round", {
    id: "tutor", name: "Tutor", role: "tutor",
  });
  completeFirst();
  expect(await first).toMatchObject({ sessionId: second.sessionId });
  const [loser, winner] = f.create.mock.calls.map(([name]) => name);
  expect(loser).not.toBe(winner);
  expect(f.close).toHaveBeenCalledTimes(1);
  expect(f.close).toHaveBeenCalledWith(loser);
  expect(f.token.mock.calls.map(([name]) => name)).toEqual([winner, winner]);
});

it("withholds replacement credentials when a retired room cannot be deleted", async () => {
  const f = fixture();
  const actor = { id: "tutor", name: "Tutor", role: "tutor" } as const;
  await f.service.ticket("round", actor);
  f.setRound({ ...base, phase: "feedback", phaseStartedAt: "2026-11-05T10:01:00Z" });
  f.close.mockRejectedValueOnce(new Error("Provider unavailable"));
  await expect(f.service.ticket("round", actor)).rejects.toThrow("Provider unavailable");
  expect(f.create).toHaveBeenCalledTimes(1);
  expect(f.token).toHaveBeenCalledTimes(1);
  await expect(f.service.ticket("round", actor)).resolves.toMatchObject({ token: "token" });
});

it("does not mint if the round pauses while the provider room is provisioning", async () => {
  const f = fixture();
  f.create.mockImplementationOnce(async (name) => {
    f.setRound({ ...base, pausedAt: "2026-11-05T10:01:00Z" });
    return `https://example.daily.co/${name}`;
  });
  await expect(f.service.ticket("round", { id: "tutor", name: "Tutor", role: "tutor" }))
    .resolves.toMatchObject({ sessionId: null });
  expect(f.token).not.toHaveBeenCalled();
  expect(f.close).toHaveBeenCalledWith(f.create.mock.calls[0]![0]);
});


it("waits for another ticket if a phase transition races the room snapshot", async () => {
  const f = fixture();
  const actor = { id: "tutor", name: "Tutor", role: "tutor" } as const;
  await f.service.ticket("round", actor);
  const list = f.store.sessions;
  jest.spyOn(f.store, "sessions").mockImplementationOnce(async (id) => {
    const sessions = await list(id);
    f.setRound({ ...base, phase: "feedback", phaseStartedAt: "2026-11-05T10:01:00Z" });
    return sessions;
  });
  await expect(f.service.ticket("round", actor)).resolves.toMatchObject({ sessionId: null });
  expect(f.create).toHaveBeenCalledTimes(1);
  expect(f.close).toHaveBeenCalledWith(f.create.mock.calls[0]![0]);
  await expect(f.service.ticket("round", actor)).resolves.toMatchObject({ token: "token" });
});
