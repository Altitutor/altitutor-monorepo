import type { StudentInterviewRound } from "@altitutor/shared";
import {
  studentInfoCard,
  studentReadingSeconds,
  studentShowsReadingClock,
} from "../presentation";

const timing = { phaseDeadline: "2026-10-23T10:02:00Z", pausedAt: null };
describe("student reading timer boundary", () => {
  it("does not expose a question countdown even if the server accidentally includes its deadline", () => {
    expect(
      studentReadingSeconds(
        { ...timing, phase: "questions" } as StudentInterviewRound,
        Date.parse("2026-10-23T10:00:00Z"),
      ),
    ).toBeNull();
  });
  it("counts reading down against the synchronized server clock and freezes while paused", () => {
    expect(
      studentReadingSeconds(
        { ...timing, phase: "reading" } as StudentInterviewRound,
        Date.parse("2026-10-23T10:00:30Z"),
      ),
    ).toBe(90);
    expect(
      studentReadingSeconds(
        {
          ...timing,
          phase: "reading",
          pausedAt: "2026-10-23T10:00:45Z",
        } as StudentInterviewRound,
        Date.parse("2026-10-23T10:05:00Z"),
      ),
    ).toBe(75);
    expect(
      studentReadingSeconds(
        { ...timing, phase: "reading" } as StudentInterviewRound,
        Date.parse("2026-10-23T10:03:00Z"),
      ),
    ).toBe(0);
  });
});

function info(overrides: Partial<StudentInterviewRound>) {
  return studentInfoCard({
    startedAt: "2026-10-23T10:00:00Z",
    phase: "reading",
    mode: "exam",
    stationId: "station-1",
    endedEarly: false,
    ...overrides,
  } as StudentInterviewRound);
}

describe("student interview room info", () => {
  it("tells the student to wait for a station to start", () => {
    expect(info({ phase: "waiting", startedAt: null }).body).toBe(
      "Wait here for your station to start.",
    );
  });

  it("tells the student to wait for the next station during exam feedback", () => {
    expect(info({ phase: "feedback", mode: "exam" })).toMatchObject({
      variant: "instructions",
      body: "Wait here for the next station.",
    });
  });

  it("shows the prompt during reading and question time", () => {
    expect(info({ phase: "reading" })).toMatchObject({
      variant: "prompt",
      title: "Reading time",
    });
    expect(info({ phase: "questions", mode: "feedback" })).toMatchObject({
      variant: "prompt",
      title: "Question time",
    });
  });

  it("shows the prompt during teaching feedback", () => {
    expect(info({ phase: "feedback", mode: "feedback" })).toMatchObject({
      variant: "prompt",
      title: "Feedback time",
    });
  });

  it("shows the reading clock only during exam reading time", () => {
    const round = {
      phase: "reading",
      mode: "exam",
    } as StudentInterviewRound;
    expect(studentShowsReadingClock(round)).toBe(true);
    expect(studentShowsReadingClock({ ...round, phase: "questions" })).toBe(
      false,
    );
    expect(studentShowsReadingClock({ ...round, mode: "feedback" })).toBe(
      false,
    );
  });
});
