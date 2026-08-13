import type { QuestionItem } from "@/features/question-engine/model/types";
import { scorePracticeAnswers } from "@/lib/ucat/practice-sessions/complete-student-practice-session";

describe("scorePracticeAnswers", () => {
  it("derives single-choice and placement scores from canonical responses", () => {
    const questions = [
      {
        id: "multiple-choice",
        stemId: "stem-1",
        sectionName: "Decision Making",
        responseType: "multiple_choice",
    answerScheme: "single_choice",
        correctOptionId: "mc-correct",
        options: [
          { id: "mc-wrong", index: 0, answerKeyValue: null },
          { id: "mc-correct", index: 1, answerKeyValue: "correct" },
        ],
      },
      {
        id: "syllogism",
        stemId: "stem-2",
        sectionName: "Decision Making",
        responseType: "drag_and_drop",
    answerScheme: "decision_making_binary_placement",
        options: [
          { id: "s-1", index: 0, answerKeyValue: "yes" },
          { id: "s-2", index: 1, answerKeyValue: "no" },
          { id: "s-3", index: 2, answerKeyValue: "yes" },
          { id: "s-4", index: 3, answerKeyValue: "no" },
          { id: "s-5", index: 4, answerKeyValue: "yes" },
        ],
      },
    ] as unknown as QuestionItem[];

    const result = scorePracticeAnswers(
      questions,
      new Map([
        [
          "multiple-choice",
          {
            questionId: "multiple-choice",
            answerSnapshot: {
              type: "ucat_response_v1",
              questionId: "multiple-choice",
              answerScheme: "single_choice",
              response: { kind: "single_select", selectedOptionId: "mc-correct" },
            },
          },
        ],
        [
          "syllogism",
          {
            questionId: "syllogism",
            answerSnapshot: {
              type: "ucat_response_v1",
              questionId: "syllogism",
              answerScheme: "decision_making_binary_placement",
              response: {
                kind: "placement",
                placements: {
                  "s-1": "yes", "s-2": "no", "s-3": "yes",
                  "s-4": "no", "s-5": "yes",
                },
              },
            },
          },
        ],
      ]),
    );

    expect(result.questionScores).toEqual(
      new Map([
        ["multiple-choice", 1],
        ["syllogism", 2],
      ]),
    );
    expect(result.totalRawScore).toBe(3);
    expect(result.maxRawScore).toBe(3);
  });
});
