import { matchRemediationLearningModules } from "../remediation-learning-modules";
import type { RemediationCatalogLesson } from "../remediation-learning-modules";

const hierarchy = [
  { id: "arithmetic", parent_question_tag_id: null },
  { id: "addition", parent_question_tag_id: "arithmetic" },
  { id: "column-addition", parent_question_tag_id: "addition" },
];

function lesson(
  overrides: Partial<RemediationCatalogLesson> &
    Pick<RemediationCatalogLesson, "id" | "title">,
): RemediationCatalogLesson {
  return {
    sectionId: "dm",
    sectionNumber: 2,
    studyPlanPriority: "recommended",
    categoryIds: [],
    authoredQuestionTagIds: [],
    ...overrides,
  };
}

const catalog = {
  tagTaxonomy: hierarchy,
  lessons: [
    lesson({
      id: "column-lesson",
      title: "Column addition",
      studyPlanPriority: "optional",
      authoredQuestionTagIds: ["column-addition"],
    }),
    lesson({
      id: "arithmetic-lesson",
      title: "Arithmetic methods",
      studyPlanPriority: "essential",
      authoredQuestionTagIds: ["arithmetic"],
      categoryIds: ["logic-puzzles"],
    }),
    lesson({
      id: "category-lesson",
      title: "Logic puzzle formats",
      studyPlanPriority: "recommended",
      categoryIds: ["logic-puzzles"],
    }),
    lesson({
      id: "excluded-lesson",
      title: "Excluded",
      studyPlanPriority: "excluded",
      authoredQuestionTagIds: ["column-addition"],
    }),
    lesson({
      id: "qr-lesson",
      title: "QR arithmetic",
      sectionId: "qr",
      sectionNumber: 3,
      authoredQuestionTagIds: ["column-addition"],
    }),
  ],
};

describe("matchRemediationLearningModules", () => {
  it("returns no lessons for a fully correct attempt", () => {
    expect(
      matchRemediationLearningModules(
        {
          result: "correct",
          questionTagIds: ["column-addition"],
          stemCategoryId: "logic-puzzles",
          sectionId: "dm",
        },
        catalog,
      ),
    ).toEqual([]);
  });

  it("prefers tag matches, including parent-tagged lessons, over category-only lessons", () => {
    expect(
      matchRemediationLearningModules(
        {
          result: "incorrect",
          questionTagIds: ["column-addition"],
          stemCategoryId: "logic-puzzles",
          sectionId: "dm",
        },
        catalog,
      ).map((item) => item.id),
    ).toEqual(["arithmetic-lesson", "column-lesson", "category-lesson"]);
  });

  it("still matches on stem category when the question has no tags", () => {
    expect(
      matchRemediationLearningModules(
        {
          result: "partial",
          questionTagIds: [],
          stemCategoryId: "logic-puzzles",
          sectionId: "dm",
        },
        catalog,
      ).map((item) => item.id),
    ).toEqual(["arithmetic-lesson", "category-lesson"]);
  });

  it("does not recommend excluded lessons or lessons from another section", () => {
    const ids = matchRemediationLearningModules(
      {
        result: "incorrect",
        questionTagIds: ["column-addition"],
        stemCategoryId: null,
        sectionId: "dm",
      },
      catalog,
    ).map((item) => item.id);

    expect(ids).not.toContain("excluded-lesson");
    expect(ids).not.toContain("qr-lesson");
  });
});
