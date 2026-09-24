import type { QuestionItem } from "@/features/question-engine/model/types";
import {
  mapQuestionStemsToItems,
  type QuestionStemWithQuestions,
} from "@/features/question-engine/model/types";
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

  it("scores immutable practice snapshots created before response contracts", () => {
    const legacySnapshot = [
      {
        id: "stem-1",
        questionSetId: "practice",
        sectionName: "Decision Making",
        sectionDisplayColumns: 1,
        stemText: "Legacy stem",
        questions: [
          {
            id: "multiple-choice",
            index: 0,
            questionText: "Legacy multiple choice",
            questionType: "multiple_choice",
            options: [
              { id: "mc-wrong", index: 0, text: "Wrong", isAnswer: false },
              { id: "mc-correct", index: 1, text: "Correct", isAnswer: true },
            ],
          },
          {
            id: "syllogism",
            index: 1,
            questionText: "Legacy syllogism",
            questionType: "syllogism",
            options: [
              { id: "s-1", index: 0, text: "One", isAnswer: true },
              { id: "s-2", index: 1, text: "Two", isAnswer: false },
              { id: "s-3", index: 2, text: "Three", isAnswer: true },
              { id: "s-4", index: 3, text: "Four", isAnswer: false },
              { id: "s-5", index: 4, text: "Five", isAnswer: true },
            ],
          },
        ],
      },
    ] as unknown as QuestionStemWithQuestions[];
    const questions = mapQuestionStemsToItems(legacySnapshot);

    expect(questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "multiple-choice",
          responseType: "multiple_choice",
          answerScheme: "single_choice",
          correctOptionId: "mc-correct",
        }),
        expect.objectContaining({
          id: "syllogism",
          responseType: "drag_and_drop",
          answerScheme: "decision_making_binary_placement",
          options: expect.arrayContaining([
            expect.objectContaining({ id: "s-1", answerKeyValue: "yes" }),
            expect.objectContaining({ id: "s-2", answerKeyValue: "no" }),
          ]),
        }),
      ]),
    );

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
                  "s-1": "yes",
                  "s-2": "no",
                  "s-3": "yes",
                  "s-4": "no",
                  "s-5": "yes",
                },
              },
            },
          },
        ],
      ]),
    );

    expect(result.totalRawScore).toBe(3);
    expect(result.maxRawScore).toBe(3);
  });
});
