import { subjectBadges } from "../subject-badges";

test("deduplicates within each curriculum while preserving IB and SACE separately", () => {
  expect(
    subjectBadges([
      { name: "Biology", curriculum: "SACE" },
      { name: "Biology", curriculum: "SACE" },
      { name: "Biology", curriculum: "IB" },
      { name: "Biology", curriculum: "IB" },
      { name: "Mathematics", curriculum: "PRESACE" },
      { name: "Mathematics", curriculum: "PRESACE" },
      { name: "English", curriculum: "PRIMARY" },
      { name: "English", curriculum: "PRIMARY" },
      { name: "UCAT", curriculum: null },
      { name: "Medicine Interview", curriculum: null },
    ]),
  ).toEqual([
    "SACE Biology",
    "IB Biology",
    "PreSACE Mathematics",
    "Primary English",
    "Medicine Interview",
    "UCAT",
  ]);
});

test("keeps genuinely different subject names and omits empty names", () => {
  expect(
    subjectBadges([
      { name: "Mathematics AA", curriculum: "IB" },
      { name: "Mathematics AI", curriculum: "IB" },
      { name: "English General", curriculum: "SACE" },
      { name: "English Literature", curriculum: "SACE" },
      { name: " ", curriculum: null },
    ]),
  ).toEqual([
    "SACE English General",
    "SACE English Literature",
    "IB Mathematics AA",
    "IB Mathematics AI",
  ]);
});

test("formats all supplied subjects; visibility is controlled by the public view", () => {
  expect(
    subjectBadges([
      { name: "Homework Help", curriculum: null },
      { name: "UCAT", curriculum: null },
    ]),
  ).toEqual(["Homework Help", "UCAT"]);
});
