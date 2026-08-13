import { projectStoredQuestionAttemptReview } from "../attempt-response-review";
import type { QuestionItem } from "@/features/question-engine/model/types";

const question: QuestionItem = {
  id: "f1e5a6be-a5b3-4dec-ae55-140d1c8cab6b",
  index: 0,
  questionSetId: "937edded-c7d5-4766-9453-b2686f961e2d",
  stemId: "a799dfbf-aa6e-467a-9e08-89b3b9c4c234",
  sectionName: "Situational Judgement",
  sectionDisplayColumns: 1,
  stemText: "test most least",
  questionText: "question most least",
  questionType: "multiple_choice",
  responseType: "drag_and_drop",
  answerScheme: "situational_judgement_most_least",
  options: [
    { id: "most-option", index: 0, text: "most", answerKeyValue: "most" },
    { id: "least-option", index: 1, text: "jleast", answerKeyValue: "least" },
    { id: "middle-option", index: 2, text: "none", answerKeyValue: null },
  ],
};

describe("projectStoredQuestionAttemptReview", () => {
  it("restores a canonical Most/Least snapshot and preserves its stored score", () => {
    const projection = projectStoredQuestionAttemptReview(question, {
      score: 6,
      questionAnswerOptionId: null,
      answerSnapshot: {
        type: "ucat_response_v1",
        questionId: question.id,
        answerScheme: "situational_judgement_most_least",
        response: {
          kind: "placement",
          placements: {
            "most-option": "most",
            "middle-option": "least",
          },
        },
      },
    });

    expect(projection?.points).toBe(6);
    expect(projection?.review).toMatchObject({
      kind: "placement",
      rows: [
        { targetId: "most-option", placedToken: "most", correctToken: "most" },
        { targetId: "least-option", placedToken: null, correctToken: "least" },
        { targetId: "middle-option", placedToken: "least", correctToken: null },
      ],
      outcome: "partial",
    });
  });
});
