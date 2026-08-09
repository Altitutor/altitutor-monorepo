import {
  canonicalizeEngineResponses,
  buildPersistedQuestionResponse,
  evaluatePersistedQuestionResponse,
  parseBinaryPlacementResponseSnapshot,
  restoreQuestionResponse,
  snapshotQuestionResponse,
} from "@/features/question-engine/lib/response-state";
import type { QuestionItem } from "@/features/question-engine/model/types";

const singleChoiceQuestion = {
  id: "single-choice",
  responseType: "multiple_choice",
  answerScheme: "single_choice",
  options: [
    { id: "option-a", index: 0, answerKeyValue: null },
    { id: "option-b", index: 1, answerKeyValue: "correct" },
  ],
} as QuestionItem;

const binaryQuestion = {
  id: "binary",
  responseType: "drag_and_drop",
  answerScheme: "decision_making_binary_placement",
  options: [
    { id: "statement-1", index: 0, answerKeyValue: "yes" },
    { id: "statement-2", index: 1, answerKeyValue: "no" },
    { id: "statement-3", index: 2, answerKeyValue: "yes" },
    { id: "statement-4", index: 3, answerKeyValue: "no" },
    { id: "statement-5", index: 4, answerKeyValue: "yes" },
  ],
} as QuestionItem;

const mostLeastQuestion = {
  ...singleChoiceQuestion,
  id: "most-least",
  questionType: "multiple_choice",
  responseType: "drag_and_drop",
  answerScheme: "situational_judgement_most_least",
  options: [
    { id: "action-a", index: 0, answerKeyValue: "most" },
    { id: "action-b", index: 1, answerKeyValue: null },
    { id: "action-c", index: 2, answerKeyValue: "least" },
  ],
} as QuestionItem;

describe("canonical question response persistence", () => {
  it("writes canonical snapshots for single choice, DM placement, and blanks", () => {
    expect(snapshotQuestionResponse(singleChoiceQuestion, "option-b")).toEqual({
      type: "ucat_response_v1",
      questionId: "single-choice",
      answerScheme: "single_choice",
      response: { kind: "single_select", selectedOptionId: "option-b" },
    });
    expect(snapshotQuestionResponse(singleChoiceQuestion)).toEqual({
      type: "ucat_response_v1",
      questionId: "single-choice",
      answerScheme: "single_choice",
      response: { kind: "single_select", selectedOptionId: null },
    });
    expect(
      snapshotQuestionResponse(binaryQuestion, undefined, {
        "statement-1": true,
        "statement-2": false,
      }),
    ).toEqual({
      type: "ucat_response_v1",
      questionId: "binary",
      answerScheme: "decision_making_binary_placement",
      response: {
        kind: "placement",
        placements: { "statement-1": "yes", "statement-2": "no" },
      },
    });
  });

  it("round-trips Most/Least placements through the engine persistence projection", () => {
    const snapshot = snapshotQuestionResponse(mostLeastQuestion, undefined, {
      "action-a": true,
      "action-c": false,
    });

    expect(snapshot).toEqual({
      type: "ucat_response_v1",
      questionId: "most-least",
      answerScheme: "situational_judgement_most_least",
      response: {
        kind: "placement",
        placements: { "action-a": "most", "action-c": "least" },
      },
    });
    expect(restoreQuestionResponse(mostLeastQuestion, snapshot)).toEqual({
      selectedOptionId: null,
      syllogismSnapshot: { "action-a": true, "action-c": false },
    });
    expect(evaluatePersistedQuestionResponse(mostLeastQuestion, snapshot)).toEqual(
      expect.objectContaining({
        complete: true,
        score: { awarded: 8, maximum: 8 },
      }),
    );
  });

  it("rejects invalid option IDs instead of persisting them as blank", () => {
    expect(() =>
      snapshotQuestionResponse(singleChoiceQuestion, "not-an-option"),
    ).toThrow("unknown option");
  });

  it("isolates legacy DM reads and restores them into engine state", () => {
    expect(
      restoreQuestionResponse(binaryQuestion, {
        type: "syllogism_v1",
        answers: [
          { question_answer_option_id: "statement-1", answer: true },
          { question_answer_option_id: "statement-2", answer: false },
        ],
      }),
    ).toEqual({
      selectedOptionId: null,
      syllogismSnapshot: { "statement-1": true, "statement-2": false },
    });
  });

  it("rejects mismatched snapshots and duplicate once-only tokens", () => {
    expect(() =>
      restoreQuestionResponse(singleChoiceQuestion, {
        type: "ucat_response_v1",
        questionId: "different-question",
        answerScheme: "single_choice",
        response: { kind: "single_select", selectedOptionId: "option-b" },
      }),
    ).toThrow("different question");

    expect(() =>
      restoreQuestionResponse(mostLeastQuestion, {
        type: "ucat_response_v1",
        questionId: "most-least",
        answerScheme: "situational_judgement_most_least",
        response: {
          kind: "placement",
          placements: { "action-a": "most", "action-b": "most" },
        },
      }),
    ).toThrow("only once");
  });

  it("hydrates canonical engine snapshots and upgrades legacy engine state", () => {
    const canonical = canonicalizeEngineResponses([singleChoiceQuestion], {
      responseSnapshots: {
        "single-choice": snapshotQuestionResponse(
          singleChoiceQuestion,
          "option-b",
        ),
      },
      selectedAnswers: {},
      syllogismSnapshots: {},
    });
    expect(canonical.selectedAnswers).toEqual({
      "single-choice": "option-b",
    });

    const upgraded = canonicalizeEngineResponses([binaryQuestion], {
      selectedAnswers: {},
      syllogismSnapshots: { binary: { "statement-1": true } },
    });
    expect(upgraded.responseSnapshots.binary).toEqual(
      expect.objectContaining({ type: "ucat_response_v1" }),
    );
  });

  it("owns compatibility-column persistence and canonical DM review reads", () => {
    expect(
      buildPersistedQuestionResponse(singleChoiceQuestion, "option-b"),
    ).toEqual({
      questionAnswerOptionId: "option-b",
      answerSnapshot: expect.objectContaining({ type: "ucat_response_v1" }),
    });
    const persistedDm = buildPersistedQuestionResponse(
      binaryQuestion,
      undefined,
      { "statement-1": true, "statement-2": false },
    );
    expect(persistedDm.questionAnswerOptionId).toBeNull();
    expect(
      parseBinaryPlacementResponseSnapshot(
        persistedDm.answerSnapshot,
        "binary",
      ),
    ).toEqual({ "statement-1": true, "statement-2": false });
  });

  it("projects score, maximum, and review for canonical and historical snapshots", () => {
    expect(
      evaluatePersistedQuestionResponse(
        singleChoiceQuestion,
        snapshotQuestionResponse(singleChoiceQuestion, "option-b"),
      ),
    ).toEqual(
      expect.objectContaining({
        score: { awarded: 1, maximum: 1 },
        review: expect.objectContaining({ outcome: "correct" }),
      }),
    );

    expect(
      evaluatePersistedQuestionResponse(binaryQuestion, {
        type: "syllogism_v1",
        answers: [
          { question_answer_option_id: "statement-1", answer: true },
          { question_answer_option_id: "statement-2", answer: false },
          { question_answer_option_id: "statement-3", answer: true },
          { question_answer_option_id: "statement-4", answer: false },
          { question_answer_option_id: "statement-5", answer: false },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        score: { awarded: 1, maximum: 2 },
        review: expect.objectContaining({ outcome: "partial" }),
      }),
    );
  });
});
