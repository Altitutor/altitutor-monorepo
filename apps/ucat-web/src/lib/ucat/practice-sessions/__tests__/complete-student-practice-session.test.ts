import type { QuestionItem } from "@/features/question-engine/model/types";
import { scorePracticeAnswers } from "@/lib/ucat/practice-sessions/complete-student-practice-session";

describe("scorePracticeAnswers", () => {
  it("derives multiple-choice and syllogism scores from server content", () => {
    const questions = [
      {
        id: "multiple-choice",
        stemId: "stem-1",
        sectionName: "Decision Making",
        questionType: "multiple_choice",
        correctOptionId: "mc-correct",
        options: [
          { id: "mc-wrong", index: 0, isAnswer: false },
          { id: "mc-correct", index: 1, isAnswer: true },
        ],
      },
      {
        id: "syllogism",
        stemId: "stem-2",
        sectionName: "Decision Making",
        questionType: "syllogism",
        options: [
          { id: "s-1", index: 0, isAnswer: true },
          { id: "s-2", index: 1, isAnswer: false },
          { id: "s-3", index: 2, isAnswer: true },
          { id: "s-4", index: 3, isAnswer: false },
          { id: "s-5", index: 4, isAnswer: true },
        ],
      },
    ] as QuestionItem[];

    const result = scorePracticeAnswers(
      questions,
      new Map([
        [
          "multiple-choice",
          {
            questionId: "multiple-choice",
            questionAnswerOptionId: "mc-correct",
          },
        ],
        [
          "syllogism",
          {
            questionId: "syllogism",
            questionAnswerOptionId: null,
            answerSnapshot: {
              type: "syllogism_v1",
              answers: [
                { question_answer_option_id: "s-1", answer: true },
                { question_answer_option_id: "s-2", answer: false },
                { question_answer_option_id: "s-3", answer: true },
                { question_answer_option_id: "s-4", answer: false },
                { question_answer_option_id: "s-5", answer: true },
              ],
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
