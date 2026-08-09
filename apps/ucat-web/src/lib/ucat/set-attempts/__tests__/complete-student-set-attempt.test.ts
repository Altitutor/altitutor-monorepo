import {
  buildQuestionAttemptsForScoring,
  buildQuestionMetaFromAttemptSnapshots,
} from "@/lib/ucat/set-attempts/complete-student-set-attempt";

const snapshot = {
  schemaVersion: 1,
  stem: {
    id: "stem-1",
    sectionName: "Decision Making",
  },
  question: {
    id: "question-1",
    questionType: "multiple_choice",
  },
  answerOptions: [
    { id: "option-1", index: 0, isAnswer: false },
    { id: "option-2", index: 1, isAnswer: true },
  ],
};

describe("buildQuestionMetaFromAttemptSnapshots", () => {
  it("builds authoritative marking metadata without catalogue queries", () => {
    expect(
      buildQuestionMetaFromAttemptSnapshots(
        [
          {
            id: "attempt-1",
            student_id: "student-1",
            question_id: "question-1",
            question_answer_option_id: "option-2",
            answer_snapshot: null,
            content_snapshot: snapshot,
          },
        ],
        new Set(["question-1"]),
      ),
    ).toEqual([
      {
        id: "question-1",
        stemId: "stem-1",
        sectionName: "Decision Making",
        questionType: "multiple_choice",
        correctOptionId: "option-2",
        options: [
          { id: "option-1", index: 0 },
          { id: "option-2", index: 1 },
        ],
      },
    ]);
  });

  it("reports when any expected immutable snapshot is absent or malformed", () => {
    expect(
      buildQuestionMetaFromAttemptSnapshots([], new Set(["question-1"])),
    ).toBeNull();
    expect(
      buildQuestionMetaFromAttemptSnapshots(
        [
          {
            id: "attempt-1",
            student_id: "student-1",
            question_id: "question-1",
            question_answer_option_id: null,
            answer_snapshot: null,
            content_snapshot: { ...snapshot, answerOptions: null },
          },
        ],
        new Set(["question-1"]),
      ),
    ).toBeNull();
  });
});

describe("buildQuestionAttemptsForScoring", () => {
  it("carries canonical DM placements into set and mock scoring", () => {
    expect(
      buildQuestionAttemptsForScoring(
        [
          {
            id: "dm-question",
            stemId: "stem-1",
            sectionName: "Decision Making",
            questionType: "syllogism",
            correctOptionId: "statement-1",
            options: [{ id: "statement-1", index: 0 }],
          },
        ],
        [
          {
            id: "attempt-1",
            student_id: "student-1",
            question_id: "dm-question",
            question_answer_option_id: null,
            answer_snapshot: {
              type: "ucat_response_v1",
              questionId: "dm-question",
              answerScheme: "decision_making_binary_placement",
              response: {
                kind: "placement",
                placements: { "statement-1": "yes" },
              },
            },
          },
        ],
      ),
    ).toEqual([
      { questionId: "dm-question", selectedOptionId: "statement-1" },
    ]);
  });
});
