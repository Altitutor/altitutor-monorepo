/** @jest-environment node */
import { fetchAdminInterviewObserver } from "../round";

const station = {
  id: "station-a",
  name: "Motivation",
  prompt: "Frozen prompt",
  maximumPoints: 6,
  questions: [
    {
      id: "question-a",
      questionId: "bank-a",
      question: "Why?",
      rubric: "Current guidance",
      rubricVersion: 2,
    },
  ],
};
const response = {
  id: "round-a",
  round: {
    id: "round-a",
    phase: "questions",
    serverNow: "2026-11-21T06:00:00Z",
    stations: [{ id: "station-a", name: "Motivation", questionCount: 1 }],
  },
  selectedStationId: "station-a",
  contentRevision: "revision-a",
  content: { station, attempt: null },
};

beforeEach(() => {
  global.fetch = jest.fn();
});

test("a two-second observer refresh retains unchanged selected content while replacing live state", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(response));
  const initial = await fetchAdminInterviewObserver("round-a", "station-a");
  jest
    .mocked(fetch)
    .mockResolvedValueOnce(
      Response.json({
        ...response,
        round: { ...response.round, phase: "feedback" },
        content: null,
      }),
    );
  const refreshed = await fetchAdminInterviewObserver(
    "round-a",
    "station-a",
    initial,
  );
  expect(refreshed.round.phase).toBe("feedback");
  expect(refreshed.content?.station.prompt).toBe("Frozen prompt");
  expect(String(jest.mocked(fetch).mock.calls[1]?.[0])).toContain(
    "contentRevision=revision-a",
  );
});

test("a changed content revision cannot silently retain an older rubric", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(response));
  const initial = await fetchAdminInterviewObserver("round-a", "station-a");
  jest
    .mocked(fetch)
    .mockResolvedValueOnce(
      Response.json({
        ...response,
        contentRevision: "revision-b",
        content: null,
      }),
    );
  await expect(
    fetchAdminInterviewObserver("round-a", "station-a", initial),
  ).rejects.toThrow("content");
});

test("a response for a different station cannot populate the current observer selection", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(response));
  await expect(
    fetchAdminInterviewObserver("round-a", "station-b"),
  ).rejects.toThrow("selection");
});
