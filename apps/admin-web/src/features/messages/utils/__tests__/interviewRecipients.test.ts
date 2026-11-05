import { interviewRecipients } from "../interviewRecipients";
test("interview grouping is deterministic and includes each recipient once", () => {
  const rounds = [
    { id: "r1", name: "Morning MMI", studentIds: ["bob", "alice"] },
    { id: "r2", name: "Evening MMI", studentIds: ["alice"] },
  ];
  const result = interviewRecipients(
    [
      { id: "other", first_name: "Zed", last_name: "Z" },
      { id: "alice", first_name: "Alice", last_name: "A" },
      { id: "bob", first_name: "Bob", last_name: "B" },
    ],
    rounds,
    "interview",
  );
  expect(result.map((entry) => entry.student.id)).toEqual([
    "alice",
    "bob",
    "other",
  ]);
  expect(result.map((entry) => entry.group)).toEqual([
    "Evening MMI · Morning MMI",
    "Morning MMI",
    "No interview",
  ]);
});

test("multi-interview group labels and sorting do not depend on query result order", () => {
  const rounds = [
    { id: "later", name: "Evening MMI", studentIds: ["alice"] },
    { id: "earlier", name: "Morning MMI", studentIds: ["alice", "bob"] },
  ];
  const students = [
    { id: "bob", first_name: "Bob", last_name: "B" },
    { id: "alice", first_name: "Alice", last_name: "A" },
  ];
  const expected = [
    { student: students[1], group: "Evening MMI · Morning MMI" },
    { student: students[0], group: "Morning MMI" },
  ];
  expect(interviewRecipients(students, rounds, "interview")).toEqual(expected);
  expect(
    interviewRecipients(students, [...rounds].reverse(), "interview"),
  ).toEqual(expected);
});
