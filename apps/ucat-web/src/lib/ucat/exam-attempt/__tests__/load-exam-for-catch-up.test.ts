import { buildPersistedQuestionResponse } from "@/features/question-engine/lib/response-state";
import { mapSetQuestionsForCatchUp } from "@/lib/ucat/exam-attempt/load-exam-for-catch-up";

describe("mapSetQuestionsForCatchUp", () => {
  it("preserves the canonical response contract while normalizing historical one-based options", () => {
    const questions = mapSetQuestionsForCatchUp(
      "set-1",
      [
        {
          stem_id: "stem-1",
          questions_meta: [{ id: "question-1", index: 1 }],
        },
      ],
      [
        {
          id: "stem-1",
          section_name: "Verbal Reasoning",
          section_instructions_time_limit_seconds: null,
          questions: [
            {
              id: "question-1",
              index: 1,
              question_type: "multiple_choice",
              response_type: "multiple_choice",
              answer_scheme: "single_choice",
              answer_options: [
                {
                  id: "option-1",
                  index: 1,
                  is_answer: true,
                  answer_key_value: "correct",
                },
                {
                  id: "option-2",
                  index: 2,
                  is_answer: false,
                  answer_key_value: null,
                },
              ],
            },
          ],
        },
      ],
    );

    expect(questions[0]).toEqual(
      expect.objectContaining({
        responseType: "multiple_choice",
        answerScheme: "single_choice",
        options: [
          expect.objectContaining({
            id: "option-1",
            index: 1,
            answerKeyValue: "correct",
          }),
          expect.objectContaining({
            id: "option-2",
            index: 2,
            answerKeyValue: null,
          }),
        ],
      }),
    );
    expect(buildPersistedQuestionResponse(questions[0])).toEqual({
      questionAnswerOptionId: null,
      answerSnapshot: {
        type: "ucat_response_v1",
        questionId: "question-1",
        answerScheme: "single_choice",
        response: { kind: "single_select", selectedOptionId: null },
      },
    });
  });
});
