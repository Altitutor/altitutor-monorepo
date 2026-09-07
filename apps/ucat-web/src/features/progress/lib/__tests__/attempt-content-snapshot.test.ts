import { snapshotQuestionMetadata } from "../attempt-content-snapshot";

describe("snapshotQuestionMetadata", () => {
  it("keeps question tag ids so missed questions can match related lessons", () => {
    expect(
      snapshotQuestionMetadata({
        schemaVersion: 1,
        stem: {
          id: "stem-1",
          categoryId: "category-1",
          categoryName: "Logic puzzles",
          stemText: "Stem",
        },
        question: {
          id: "question-1",
          questionText: "Question",
          index: 0,
          responseType: "multiple_choice",
          answerScheme: "single_choice",
          tags: [
            { id: "tag-inference", name: "Inference", description: "A trap." },
          ],
        },
        answerOptions: [],
      }).questionTags,
    ).toEqual([
      {
        id: "tag-inference",
        name: "Inference",
        description: "A trap.",
      },
    ]);
  });
});
