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
    responseType: "multiple_choice",
    answerScheme: "single_choice",
  },
  answerOptions: [
    { id: "option-1", index: 0, answerKeyValue: null },
    { id: "option-2", index: 1, answerKeyValue: "correct" },
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
            answer_snapshot: null,
            content_snapshot: snapshot,
          },
        ],
        new Set(["question-1"]),
      ),
    ).toEqual([
      {
        sectionName: "Decision Making",
        definition: {
          questionId: "question-1",
          responseType: "multiple_choice",
          answerScheme: { kind: "single_choice", correctOptionId: "option-2" },
          options: [
            { id: "option-1", index: 0 },
            { id: "option-2", index: 1 },
          ],
        },
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
            sectionName: "Decision Making",
            definition: {
              questionId: "dm-question",
              responseType: "drag_and_drop",
              answerScheme: {
                kind: "decision_making_binary_placement",
                correctByOptionId: {
                  "statement-1": "yes",
                  "statement-2": "no",
                  "statement-3": "yes",
                  "statement-4": "no",
                  "statement-5": "yes",
                },
              },
              options: [1, 2, 3, 4, 5].map((index) => ({
                id: `statement-${index}`,
                index: index - 1,
              })),
            },
          },
        ],
        [
          {
            id: "attempt-1",
            student_id: "student-1",
            question_id: "dm-question",
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
    ).toEqual(
      new Map([
        [
          "dm-question",
          { kind: "placement", placements: { "statement-1": "yes" } },
        ],
      ]),
    );
  });
});
