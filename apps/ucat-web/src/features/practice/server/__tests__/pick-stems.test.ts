import type { SupabaseClient } from "@supabase/supabase-js";
import { pickStems } from "../pick-stems";

describe("pickStems", () => {
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
});
