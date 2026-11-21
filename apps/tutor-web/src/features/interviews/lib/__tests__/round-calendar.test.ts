import type { TutorInterviewRoundSummary } from "@altitutor/shared";
import { roundCanEdit, roundRoomPath, toScheduledRound } from "../round-calendar";

const round: TutorInterviewRoundSummary = {
  id: "round", version: 1, createdBy: "tutor", createdAt: "2026-11-20T00:00:00Z", updatedAt: "2026-11-20T00:00:00Z",
  interviewId: "interview", name: "Monday circuit", delivery: "online", mode: "exam", recordingEnabled: true,
  scheduledAt: "2026-11-23T09:00:00Z", startedAt: null, phase: "waiting", readingTimeSeconds: 60, questionTimeSeconds: 90,
  rotationAllowanceSeconds: 120, studentIds: ["student"], assignments: [{ stationId: "station", tutorId: "tutor" }],
  students: [{ id: "student", name: "Alex" }], tutors: [{ id: "tutor", name: "Jordan" }], stationCount: 13, releasedResultCount: 0,
};

it("builds the tutor calendar's complete duration and roster from a compact list response", () => {
  expect(toScheduledRound(round, "Medicine")).toEqual({
    id: "round", name: "Monday circuit", interviewName: "Medicine", scheduledAt: "2026-11-23T09:00:00Z",
    endAt: "2026-11-23T09:58:30.000Z", startedAt: null, phase: "waiting", delivery: "online", mode: "exam", recordingEnabled: true,
    students: [{ id: "student", name: "Alex" }], tutors: [{ id: "tutor", name: "Jordan" }],
  });
  expect(toScheduledRound({ ...round, scheduledAt: null }, "Medicine")).toBeNull();
});

it("keeps waiting-room edits and started-round rejoining distinct even between rotations", () => {
  expect(roundCanEdit(round)).toBe(true);
  expect(roundRoomPath(round)).toBe("/interviews/rounds/round/waiting");
  const started = { ...round, startedAt: "2026-11-23T09:00:00Z" };
  expect(roundCanEdit(started)).toBe(false);
  expect(roundRoomPath(started)).toBe("/interviews/rounds/round/live");
  expect(roundRoomPath({ ...started, phase: "completed" })).toBe("/interviews/rounds/round/results");
});
