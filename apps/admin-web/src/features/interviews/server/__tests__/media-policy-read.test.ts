/** @jest-environment node */
import { GET, POST } from "@/app/api/interviews/rounds/[roundId]/media/route";
import { readAdminInterviewRound, readAdminInterviewMediaRound, renewAdminInterviewPresence } from "../read";

jest.mock("../read", () => ({
  readAdminInterviewRound: jest.fn(() => { throw new Error("Full observer projection unavailable"); }),
  readAdminInterviewMediaRound: jest.fn(),
  renewAdminInterviewPresence: jest.fn(),
  interviewResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));
jest.mock("@/lib/sentry/capture-api-error", () => ({ captureApiError: jest.fn() }));
const id = "10000000-0000-4000-8000-000000000001";

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.DAILY_API_KEY;
  jest.mocked(readAdminInterviewMediaRound).mockResolvedValue({ ok: true, actorId: "admin", admin: {},
    round: { id, startedAt: null, phase: "waiting", stationIds: ["station"], serverNow: "2026-11-21T00:00:00Z" },
  } as unknown as Awaited<ReturnType<typeof readAdminInterviewMediaRound>>);
});

it("renews admin media participation separately from observer reads and rejects removed rounds", async () => {
  const context = { params: Promise.resolve({ roundId: id }) };
  const request = new Request(`https://portal.test/api/interviews/rounds/${id}/media`, { method: "POST" });
  expect((await POST(request, context)).status).toBe(200);
  expect(renewAdminInterviewPresence).toHaveBeenCalledWith(expect.objectContaining({ actorId: "admin" }), id);
  jest.mocked(readAdminInterviewMediaRound).mockResolvedValue({ ok: false, response: Response.json({}, { status: 404 }) });
  expect((await POST(request, context)).status).toBe(404);
  expect(renewAdminInterviewPresence).toHaveBeenCalledTimes(1);
  expect(readAdminInterviewRound).not.toHaveBeenCalled();
});
it("checks the shared waiting-room media request without the full observer round", async () => {
  const response = await GET(new Request(`https://portal.test/api/interviews/rounds/${id}/media`), { params: Promise.resolve({ roundId: id }) });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ sessionId: null, canSend: false, canReceive: false, recordingEnabled: false });
  expect(readAdminInterviewMediaRound).toHaveBeenCalledWith(id);
  expect(readAdminInterviewRound).not.toHaveBeenCalled();
});

it("still rejects an unknown station after the round has started", async () => {
  jest.mocked(readAdminInterviewMediaRound).mockResolvedValue({ ok: true, actorId: "admin", admin: {},
    round: { id, startedAt: "2026-11-21T00:00:00Z", phase: "waiting", stationIds: ["station"] },
  } as unknown as Awaited<ReturnType<typeof readAdminInterviewMediaRound>>);
  const response = await GET(new Request(`https://portal.test/api/interviews/rounds/${id}/media?stationId=another`), { params: Promise.resolve({ roundId: id }) });
  expect(response.status).toBe(400);
});
