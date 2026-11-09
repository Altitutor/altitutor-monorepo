import {
  activityCategory,
  matchesActivityFilters,
} from "../activityFeedFilters";

describe("activity feed filters", () => {
  it("groups billing events by what happened, even when the subject is a student or session", () => {
    expect(activityCategory("student.payment_method_added")).toBe("billing");
    expect(activityCategory("session.student_credited")).toBe("billing");
    expect(activityCategory("session.student_attended")).toBe("session");
    expect(activityCategory("staff.user_account_created")).toBe("staff");
    expect(activityCategory("new.event")).toBe("other");
  });

  it("matches text and an inclusive Adelaide date range alongside the selected activity types", () => {
    const filters = {
      type: ["session"],
      from: ["2026-11-09"],
      to: ["2026-11-09"],
    };
    const at = "2026-11-08T13:30:00Z";
    expect(
      matchesActivityFilters(
        filters,
        " ATTENDED ",
        "session",
        at,
        "Alex attended",
      ),
    ).toBe(true);
    expect(
      matchesActivityFilters(
        filters,
        "attended",
        "student",
        at,
        "Alex attended",
      ),
    ).toBe(false);
    expect(
      matchesActivityFilters(filters, "missed", "session", at, "Alex attended"),
    ).toBe(false);
    expect(
      matchesActivityFilters(
        filters,
        "",
        "session",
        "2026-11-09T13:30:00Z",
        "",
      ),
    ).toBe(false);
  });
});
