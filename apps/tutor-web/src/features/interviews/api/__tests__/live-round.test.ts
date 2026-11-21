import { getLiveInterviewRound } from "../interviews";

const revision = "a".repeat(32);
const stations = [{ id: "station", questions: [{ id: "question", rubric: "Current guidance" }] }];
const response = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 403, json: async () => body }) as Response;

afterEach(() => jest.restoreAllMocks());

test("live refreshes reuse matching station content while accepting fresh authoritative state", async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce(response({ actorId: "tutor", contentRevision: revision, round: { id: "round", version: 1, phase: "questions" }, stations }))
    .mockResolvedValueOnce(response({ actorId: "tutor", contentRevision: revision, round: { id: "round", version: 2, phase: "feedback" }, stations: null }));
  const first = await getLiveInterviewRound("round");
  const next = await getLiveInterviewRound("round", first);
  expect(next).toEqual({ id: "round", version: 2, phase: "feedback", stations, actorId: "tutor", contentRevision: revision });
  expect(global.fetch).toHaveBeenNthCalledWith(1, "/api/interviews/rounds/round?live=1", expect.objectContaining({ cache: "no-store" }));
  expect(global.fetch).toHaveBeenNthCalledWith(2, `/api/interviews/rounds/round?live=1&contentRevision=${revision}`, expect.objectContaining({ cache: "no-store" }));
});

test("a forced content recovery cannot accept another partial response from the server", async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce(response({ actorId: "tutor", contentRevision: revision, round: { id: "round", version: 1 }, stations }))
    .mockResolvedValueOnce(response({ actorId: "tutor", contentRevision: "b".repeat(32), round: { id: "round", version: 2 }, stations: null }))
    .mockResolvedValueOnce(response({ actorId: "tutor", contentRevision: revision, round: { id: "round", version: 3 }, stations: null }));
  const previous = await getLiveInterviewRound("round");
  await expect(getLiveInterviewRound("round", previous)).rejects.toThrow("Unable to load interview station content");
});

test("a different verified actor receives fresh content instead of reusing the previous actor's stations", async () => {
  const replacement = [{ id: "new-station", questions: [] }];
  global.fetch = jest.fn()
    .mockResolvedValueOnce(response({ actorId: "tutor", contentRevision: revision, round: { id: "round", version: 1 }, stations }))
    .mockResolvedValueOnce(response({ actorId: "other-tutor", contentRevision: revision, round: { id: "round", version: 2 }, stations: null }))
    .mockResolvedValueOnce(response({ actorId: "other-tutor", contentRevision: revision, round: { id: "round", version: 3 }, stations: replacement }));
  const previous = await getLiveInterviewRound("round");
  expect(await getLiveInterviewRound("round", previous)).toEqual({ id: "round", version: 3, actorId: "other-tutor", contentRevision: revision, stations: replacement });
  expect(global.fetch).toHaveBeenCalledTimes(3);
});

test("an authorization failure rejects recovery without displaying a successful cached refresh", async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce(response({ actorId: "tutor", contentRevision: revision, round: { id: "round", version: 1 }, stations }))
    .mockResolvedValueOnce(response({ error: "Interview access has ended." }, false));
  const previous = await getLiveInterviewRound("round");
  await expect(getLiveInterviewRound("round", previous)).rejects.toThrow("Interview access has ended");
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
