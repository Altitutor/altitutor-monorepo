import {
  countPracticeQuestionsByCategory,
  deriveActivityTagSignals,
} from "../practice-inventory";

describe("countPracticeQuestionsByCategory", () => {
  it("derives category availability from the accessible Practice inventory", () => {
    const counts = countPracticeQuestionsByCategory([
      {
        question_stem_category_id: "category-vr",
        question_ids: ["question-1", "question-2"],
      },
      {
        question_stem_category_id: "category-vr",
        question_ids: ["question-3"],
      },
      {
        question_stem_category_id: "category-dm",
        question_ids: ["question-4", "question-5"],
      },
      {
        question_stem_category_id: null,
        question_ids: ["question-6"],
      },
    ]);

    expect(Object.fromEntries(counts)).toEqual({
      "category-vr": 3,
      "category-dm": 2,
    });
  });

  it("derives tag inventory and independent-session evidence from whole stems", () => {
    const stems = [
      {
        id: "stem-1",
        section_id: "section-vr",
        question_stem_category_id: "category-vr",
        question_ids: ["question-1", "question-2"],
        question_tag_ids: ["tag-reading"],
      },
      {
        id: "stem-2",
        section_id: "section-vr",
        question_stem_category_id: "category-vr",
        question_ids: ["question-3"],
        question_tag_ids: ["tag-reading"],
      },
    ];

    expect(
      deriveActivityTagSignals(stems, [
        {
          id: "attempt-1",
          question_id: "question-1",
          score: 0,
          is_submitted: true,
          student_practice_session_id: "practice-1",
          student_question_set_attempt_id: null,
        },
        {
          id: "attempt-2",
          question_id: "question-2",
          score: 1,
          is_submitted: true,
          student_practice_session_id: "practice-1",
          student_question_set_attempt_id: null,
        },
        {
          id: "attempt-3",
          question_id: "question-3",
          score: 0,
          is_submitted: true,
          student_practice_session_id: null,
          student_question_set_attempt_id: "set-1",
        },
      ]),
    ).toEqual([
      {
        id: "tag-reading",
        sectionId: "section-vr",
        categoryId: "category-vr",
        availableQuestionCount: 3,
        independentSessionCount: 2,
        weaknessScore: 2 / 3,
      },
    ]);
  });
});
