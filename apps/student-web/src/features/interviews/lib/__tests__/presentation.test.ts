import type { StudentInterviewRound } from "@altitutor/shared";
import { studentReadingSeconds } from "../presentation";

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
