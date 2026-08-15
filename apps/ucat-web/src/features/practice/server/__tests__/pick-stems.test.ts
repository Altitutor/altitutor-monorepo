import type { SupabaseClient } from "@supabase/supabase-js";
import {
  maximumTieredWholeStemDose,
  maximumWholeStemDose,
  pickStems,
} from "../pick-stems";

describe("maximumWholeStemDose", () => {
  it("reports only a whole-stem dose that fits the target", () => {
    expect(maximumWholeStemDose([6, 6], 10)).toBe(6);
    expect(maximumWholeStemDose([12], 10)).toBe(0);
    expect(maximumWholeStemDose([7, 3, 6], 10)).toBe(10);
    expect(maximumTieredWholeStemDose([[6], [3], [4], []], 10)).toBe(9);
  });
});

describe("pickStems", () => {
  it("reuses a preloaded catalogue snapshot without issuing database queries", async () => {
    const from = jest.fn();
    const result = await pickStems(
      { from } as unknown as SupabaseClient,
      {
        section: "verbal_reasoning",
        questionCount: 2,
        categoryIds: ["category-1"],
        questionTagIds: ["tag-1"],
        unansweredOnly: false,
        incorrectOnly: false,
        timeMode: "off",
        timeSpeedMultiplier: 1,
        customTimeMinutes: null,
        timePerQuestionSeconds: null,
      },
      {
        deterministic: true,
        preloaded: {
          sections: [
            {
              id: "section-1",
              section_number: 1,
              time_per_question: 60,
              number_of_questions: 44,
            },
          ],
          stems: [
            {
              id: "stem-1",
              section_id: "section-1",
              question_stem_category_id: "category-1",
              question_ids: ["question-1", "question-2"],
              question_tag_ids: ["tag-1"],
            },
          ],
          attempts: [],
        },
      },
    );

    expect(result).toMatchObject({
      chosenStemIds: ["stem-1"],
      questionCount: 2,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("selects from the lightweight practice index without loading rich stem details", async () => {
    const from = jest.fn((relation: string) => {
      if (relation === "vstudent_ucat_sections") {
        return {
          select: jest.fn(() => ({
            in: jest.fn(async () => ({
              data: [
                {
                  id: "section-1",
                  section_number: 1,
                  time_per_question: 60,
                  number_of_questions: 44,
                },
              ],
              error: null,
            })),
          })),
        };
      }

      if (relation === "vstudent_ucat_practice_stem_index") {
        return {
          select: jest.fn(() => ({
            in: jest.fn(async () => ({
              data: [
                {
                  id: "stem-1",
                  section_id: "section-1",
                  question_stem_category_id: "category-1",
                  question_ids: ["question-1", "question-2"],
                },
              ],
              error: null,
            })),
          })),
        };
      }

      throw new Error(`Unexpected relation: ${relation}`);
    });

    const result = await pickStems(
      { from } as unknown as SupabaseClient,
      {
        section: "verbal_reasoning",
        questionCount: 2,
        categoryIds: [],
        unansweredOnly: false,
        incorrectOnly: false,
        timeMode: "off",
        timeSpeedMultiplier: 1,
        customTimeMinutes: null,
        timePerQuestionSeconds: null,
      },
    );

    expect(result.chosenStemIds).toEqual(["stem-1"]);
    expect(result.questionCount).toBe(2);
    expect(result.totalMatchingQuestions).toBe(2);
    expect(from.mock.calls.map(([relation]) => relation)).toEqual([
      "vstudent_ucat_sections",
      "vstudent_ucat_practice_stem_index",
    ]);
  });

  it("exhausts diverse unattempted tag matches before category-valid fallbacks", async () => {
    const sectionQuery = {
      select: jest.fn(() => ({
        in: jest.fn(async () => ({
          data: [
            {
              id: "section-1",
              section_number: 1,
              time_per_question: 60,
              number_of_questions: 44,
            },
          ],
          error: null,
        })),
      })),
    };
    const stems = [
      {
        id: "tag-a-1",
        section_id: "section-1",
        question_stem_category_id: "category-a",
        question_ids: ["question-a-1"],
        question_tag_ids: ["tag-a"],
      },
      {
        id: "tag-a-2",
        section_id: "section-1",
        question_stem_category_id: "category-a",
        question_ids: ["question-a-2"],
        question_tag_ids: ["tag-a"],
      },
      {
        id: "tag-b-1",
        section_id: "section-1",
        question_stem_category_id: "category-b",
        question_ids: ["question-b-1"],
        question_tag_ids: ["tag-b"],
      },
      {
        id: "untagged",
        section_id: "section-1",
        question_stem_category_id: "category-b",
        question_ids: ["question-u-1"],
        question_tag_ids: [],
      },
      {
        id: "outside-category",
        section_id: "section-1",
        question_stem_category_id: "category-c",
        question_ids: ["question-c-1"],
        question_tag_ids: ["tag-b"],
      },
    ];
    const categoryFilter = jest.fn(async () => ({
      data: stems.filter((stem) =>
        ["category-a", "category-b"].includes(stem.question_stem_category_id),
      ),
      error: null,
    }));
    const stemQuery = {
      select: jest.fn(() => ({
        in: jest.fn(() => ({ in: categoryFilter })),
      })),
    };
    const attemptsQuery = {
      select: jest.fn(() => ({
        in: jest.fn(async () => ({ data: [], error: null })),
      })),
    };
    const from = jest.fn((relation: string) => {
      if (relation === "vstudent_ucat_sections") return sectionQuery;
      if (relation === "vstudent_ucat_practice_stem_index") return stemQuery;
      if (relation === "vstudent_ucat_my_question_attempts") return attemptsQuery;
      throw new Error(`Unexpected relation: ${relation}`);
    });
    jest.spyOn(Math, "random").mockReturnValue(0.5);

    const result = await pickStems(
      { from } as unknown as SupabaseClient,
      {
        section: "verbal_reasoning",
        questionCount: 3,
        categoryIds: ["category-a", "category-b"],
        questionTagIds: ["tag-a", "tag-b"],
        unansweredOnly: false,
        incorrectOnly: false,
        timeMode: "off",
        timeSpeedMultiplier: 1,
        customTimeMinutes: null,
        timePerQuestionSeconds: null,
      },
    );

    expect(result.chosenStemIds).toHaveLength(3);
    expect(result.chosenStemIds).toEqual(
      expect.arrayContaining(["tag-a-1", "tag-b-1"]),
    );
    expect(result.chosenStemIds).not.toContain("outside-category");
    expect(result.chosenStemIds.at(-1)).not.toBe("untagged");
    expect(categoryFilter).toHaveBeenCalledWith(
      "question_stem_category_id",
      ["category-a", "category-b"],
    );
  });
});
