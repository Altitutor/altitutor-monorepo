import { planInterviewRounds } from "../bulk-rounds";
import type { InterviewRoundSetup, InterviewTemplate } from "@altitutor/shared";

const interview = {
  id: "interview",
  name: "Practice",
  readingTimeSeconds: 60,
  questionTimeSeconds: 300,
  stations: [{ id: "station-1" }, { id: "station-2" }],
} as InterviewTemplate;
const settings: Omit<InterviewRoundSetup, "interviewId" | "studentIds"> = {
  name: "Practice",
  delivery: "in_person",
  mode: "feedback",
  recordingEnabled: true,
  rotationAllowanceSeconds: 120,
  scheduledAt: "2026-11-14T03:30:00Z",
  assignments: [
    { stationId: "station-1", tutorId: "tutor-1" },
    { stationId: "station-2", tutorId: "tutor-2" },
  ],
};

test("six students at two stations produce three consecutive sixteen-minute rounds", () => {
  const result = planInterviewRounds({
    interview,
    settings,
    studentIds: ["a", "b", "c", "d", "e", "f"],
    groups: [
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
    ],
  });
  expect(
    result.map(({ scheduledAt, studentIds }) => ({ scheduledAt, studentIds })),
  ).toEqual([
    { scheduledAt: "2026-11-14T03:30:00.000Z", studentIds: ["a", "b"] },
    { scheduledAt: "2026-11-14T03:46:00.000Z", studentIds: ["c", "d"] },
    { scheduledAt: "2026-11-14T04:02:00.000Z", studentIds: ["e", "f"] },
  ]);
});

test.each([
  {
    groups: [
      ["a", "b"],
      ["a", "c"],
    ],
    studentIds: ["a", "b", "c"],
    message: /once/,
  },
  {
    groups: [["a"]],
    studentIds: ["a", "b"],
    message: /every selected student/,
  },
  {
    groups: [["a", "b", "c"]],
    studentIds: ["a", "b", "c"],
    message: /capacity/,
  },
])(
  "invalid allocation cannot produce a partial or overfilled series: $groups",
  ({ groups, studentIds, message }) => {
    expect(() =>
      planInterviewRounds({ interview, settings, groups, studentIds }),
    ).toThrow(message);
  },
);
