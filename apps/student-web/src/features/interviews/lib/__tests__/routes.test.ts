import { interviewRoomHref, isStudentInterviewRoom } from "../routes";

describe("student interview room shell", () => {
  it("removes the portal only for waiting/live routes, including notification deep links", () => {
    expect(isStudentInterviewRoom("/interviews/rounds/123")).toBe(true);
    expect(isStudentInterviewRoom("/interviews/rounds/123/")).toBe(true);
    expect(isStudentInterviewRoom("/interviews")).toBe(false);
    expect(isStudentInterviewRoom("/interviews/rounds/123/results")).toBe(
      false,
    );
    expect(isStudentInterviewRoom("/interviews/rounds/")).toBe(false);
  });

  it("encodes a round identifier without allowing a different route", () => {
    expect(interviewRoomHref("a/b")).toBe("/interviews/rounds/a%2Fb");
  });
});
