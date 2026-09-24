import {
  allSubjectsPlaced,
  isOpen,
  lifecycle,
  nextActions,
  type Evidence,
  type Journey,
} from "../model";
const evidence: Evidence = {
  trial_start_at: null,
  trial_booked_at: null,
  trial_session_id: null,
  trial_attended_at: null,
  trial_form_at: null,
  registration_link_at: null,
  billing_at: null,
  registered_at: null,
  subjects: [
    { id: "maths", name: "Maths" },
    { id: "chem", name: "Chemistry" },
  ],
  classes: [],
  converted_at: null,
  paid_session_id: null,
  paid_invoice_id: null,
  checkin_at: null,
  checkin_session_id: null,
  checkin_booked_at: null,
  followups: [],
};
function journey(
  change: Partial<Evidence> = {},
  overrides: Partial<Journey> = {},
): Journey {
  return {
    id: "journey",
    student_id: "student",
    contact_id: null,
    enquiry_email: null,
    label: "Student",
    enquiry_at: "2026-09-01T00:00:00Z",
    created_at: "2026-09-01T00:00:00Z",
    historical: false,
    is_returning: false,
    closed_at: null,
    closed_evidence: null,
    closure_reason: null,
    closure_detail: null,
    next_contact_at: null,
    preferences: [],
    evidence: { ...evidence, ...change },
    ...overrides,
  };
}
const maths = {
  id: "class-maths",
  subject_id: "maths",
  name: "Maths",
  enrolled_at: "2026-09-02T00:00:00Z",
  attended: 1,
  third_attended_at: null,
  checkin_due_at: "2026-09-20T00:00:00Z",
};
it("advances after first placement while retaining the remaining subject action", () => {
  const j = journey({
    registered_at: "2026-09-01T00:00:00Z",
    classes: [maths],
  });
  expect(lifecycle(j)).toBe(5);
  expect(allSubjectsPlaced(j.evidence)).toBe(false);
  expect(nextActions(j).find((a) => a.key === "enrol")?.label).toContain(
    "Chemistry",
  );
});
it("does not treat an unknown subject list as fully placed", () => {
  expect(allSubjectsPlaced({ ...evidence, subjects: [] })).toBe(false);
});
it("keeps a missing staff form visible after registration", () => {
  const j = journey({
    trial_attended_at: "2026-09-01T00:00:00Z",
    registered_at: "2026-09-02T00:00:00Z",
  });
  expect(nextActions(j).some((a) => a.key === "trial_form")).toBe(true);
});
it("uses the earliest per-class third session, not aggregate attendance", () => {
  const j = journey({
    classes: [
      maths,
      {
        ...maths,
        id: "class-chem",
        subject_id: "chem",
        attended: 2,
        checkin_due_at: "2026-09-15T00:00:00Z",
      },
    ],
  });
  expect(nextActions(j).find((a) => a.key === "checkin")?.dueAt).toBe(
    "2026-09-15T00:00:00Z",
  );
});
it("a booked check-in waits for attendance and keeps converted students open", () => {
  const j = journey({
    classes: [maths],
    converted_at: "2026-09-03T00:00:00Z",
    checkin_booked_at: "2026-09-15T00:00:00Z",
  });
  expect(isOpen(j)).toBe(true);
  expect(nextActions(j).find((a) => a.key === "checkin")?.waiting).toBe(true);
});
it("preserves historical trial evidence for returning students without requiring another form", () => {
  const j = journey(
    { trial_attended_at: "2020-01-01T00:00:00Z" },
    { is_returning: true },
  );
  expect(nextActions(j).map((a) => a.key)).not.toContain("book_trial");
  expect(nextActions(j).map((a) => a.key)).not.toContain("trial_form");
  expect(nextActions(j).map((a) => a.key)).toContain("enrol");
});
it("uses edited follow-up cadence and does not close silence automatically", () => {
  const j = journey({ registration_link_at: "2026-09-01T00:00:00Z" });
  const a = nextActions(
    j,
    {},
    new Date("2026-09-03T00:00:00Z"),
    [1, 3, 7],
  ).find((a) => a.key === "registration");
  expect(a?.overdue).toBe(true);
  expect(a?.waiting).toBe(false);
  expect(isOpen(j)).toBe(true);
});
it("booking completes the book action without inheriting its overdue date", () => {
  const j = journey({
    trial_booked_at: "2026-09-01T00:00:00Z",
    trial_start_at: "2026-10-01T00:00:00Z",
  });
  expect(nextActions(j, {}, new Date("2026-09-13T00:00:00Z"))).toEqual([
    expect.objectContaining({
      key: "trial_attendance",
      overdue: false,
      waiting: true,
    }),
  ]);
});
