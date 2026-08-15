import { expandQuestionTagIds } from "@/features/study-plan/lib/tag-hierarchy";

describe("expandQuestionTagIds", () => {
  const hierarchy = [
    { id: "arithmetic", parent_question_tag_id: null },
    { id: "addition", parent_question_tag_id: "arithmetic" },
    { id: "subtraction", parent_question_tag_id: "arithmetic" },
    { id: "column-addition", parent_question_tag_id: "addition" },
    { id: "geometry", parent_question_tag_id: null },
  ];

  it("includes all descendants recursively without including siblings of a selected child", () => {
    expect(expandQuestionTagIds(["arithmetic"], hierarchy)).toEqual([
      "arithmetic",
      "addition",
      "subtraction",
      "column-addition",
    ]);
    expect(expandQuestionTagIds(["addition"], hierarchy)).toEqual([
      "addition",
      "column-addition",
    ]);
  });

  it("deduplicates overlapping selections and retains unknown authored IDs", () => {
    expect(
      expandQuestionTagIds(["arithmetic", "addition", "unknown"], hierarchy),
    ).toEqual([
      "arithmetic",
      "addition",
      "unknown",
      "subtraction",
      "column-addition",
    ]);
  });

  it("terminates safely when malformed taxonomy rows contain a cycle", () => {
    expect(
      expandQuestionTagIds(["a"], [
        { id: "a", parent_question_tag_id: "b" },
        { id: "b", parent_question_tag_id: "a" },
      ]),
    ).toEqual(["a", "b"]);
  });
});
