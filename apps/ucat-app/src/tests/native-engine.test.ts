import assert from "node:assert/strict";
import { test } from "node:test";
import {
  restoreDraft,
  serializeDraft,
} from "../features/question-engine/model/pending-draft";
import {
  applyPlacementTransition,
  getAnswerSchemePresentation,
} from "@altitutor/ucat-response-contract";
import {
  initialSnapshot,
  segmentsFor,
  totalExamTimeLimitSeconds,
  enterSegment,
  segmentIndex,
  remainingSeconds,
  finalAnswers,
} from "../features/question-engine/model/native-engine";
import {
  snapshotQuestionResponse,
  evaluatePersistedQuestionResponse,
} from "../features/question-engine/lib/response-state";
import type {
  QuestionEngineExam,
  QuestionItem,
} from "../features/question-engine/model/types";
const question: QuestionItem = {
  id: "q1",
  index: 0,
  questionSetId: "set1",
  stemId: "stem1",
  sectionName: "Verbal Reasoning",
  sectionDisplayColumns: 1,
  stemText: "Passage",
  questionText: "Question",
  responseType: "multiple_choice",
  answerScheme: "single_choice",
  options: [
    { id: "a", index: 1, text: "A", answerKeyValue: "correct" },
    { id: "b", index: 2, text: "B" },
    { id: "c", index: 3, text: "C" },
    { id: "d", index: 4, text: "D" },
  ],
};
const exam: QuestionEngineExam = {
  sourceType: "set",
  sourceId: "set1",
  title: "Set",
  questions: [question],
  instructionsScreens: [{ instructionsJson: null }],
  setModeTiming: { setTimeLimitSeconds: 60, instructionsTimeLimitSeconds: 10 },
};
test("instructions and questions have separate server-timed segments", () => {
  const segments = segmentsFor(exam);
  const initial = initialSnapshot(exam);
  assert.equal(initial.phase, "instructions");
  assert.equal(segments[0].seconds, 10);
  const answering = enterSegment(initial, segments[1]);
  assert.equal(answering.phase, "question");
  assert.equal(segmentIndex(segments, answering), 1);
  assert.equal(segments[1].seconds, 60);
});
test("total exam time limit sums timed instructions and question segments", () => {
  assert.equal(totalExamTimeLimitSeconds(exam), 70);
  assert.equal(
    totalExamTimeLimitSeconds({
      ...exam,
      setModeTiming: {
        setTimeLimitSeconds: null,
        instructionsTimeLimitSeconds: null,
      },
    }),
    null,
  );
});
test("mock review stays scoped to its question segment", () => {
  const mock: QuestionEngineExam = {
    ...exam,
    sourceType: "mock",
    questions: [
      question,
      { ...question, id: "q2", index: 1, questionSetId: "set2" },
    ],
    mockTimingSegments: [
      {
        type: "questions",
        setIndex: 0,
        questionStartIndex: 0,
        questionEndIndex: 1,
        timeLimitSeconds: 10,
      },
      { type: "instructions", instructionsIndex: 0, timeLimitSeconds: 5 },
      {
        type: "questions",
        setIndex: 1,
        questionStartIndex: 1,
        questionEndIndex: 2,
        timeLimitSeconds: 20,
      },
    ],
  };
  const segments = segmentsFor(mock);
  assert.equal(totalExamTimeLimitSeconds(mock), 35);
  const state = enterSegment(initialSnapshot(mock), segments[2]);
  assert.equal(segmentIndex(segments, { ...state, phase: "review" }), 2);
  assert.equal(state.mockCurrentSetIndex, 1);
});
test("countdown uses the absolute deadline after backgrounding", () => {
  const now = Date.parse("2026-09-19T10:00:00Z");
  assert.equal(remainingSeconds("2026-09-19T10:01:00Z", now), 60);
  assert.equal(remainingSeconds("2026-09-19T10:01:00Z", now + 90000), 0);
  assert.equal(remainingSeconds(null, now), null);
});
test("final ledger includes unanswered questions and flags using canonical snapshots", () => {
  const state = { ...initialSnapshot(exam), flaggedIds: ["q1"] };
  const answers = finalAnswers(exam.questions, state, true, "set");
  assert.equal(answers.length, 1);
  assert.equal(answers[0].answerSnapshot.response.kind, "single_select");
  assert.deepEqual(answers[0].answerSnapshot.response, {
    kind: "single_select",
    selectedOptionId: null,
  });
  assert.equal(answers[0].isFlagged, true);
});
test("one-based answer options preserve scoring and persisted answers", () => {
  const snapshot = snapshotQuestionResponse(question, "a");
  const state = {
    ...initialSnapshot(exam),
    responseSnapshots: { q1: snapshot },
  };
  assert.deepEqual(
    finalAnswers(exam.questions, state, false, "set")[0].answerSnapshot,
    snapshot,
  );
  assert.equal(
    evaluatePersistedQuestionResponse(question, snapshot).score.awarded,
    1,
  );
});
test("most/least touch controls move unique tokens instead of duplicating them", () => {
  const presentation = getAnswerSchemePresentation(
    "situational_judgement_most_least",
    ["a", "b", "c"],
  );
  assert.equal(presentation.kind, "placement");
  if (presentation.kind !== "placement") return;
  const moved = applyPlacementTransition({
    presentation,
    placements: { a: "most", b: "least" },
    targetId: "c",
    token: "most",
  });
  assert.deepEqual(moved, { b: "least", c: "most" });
});
test("SJ ratings retain partial credit from the shared contract", () => {
  const sj = {
    ...question,
    answerScheme: "situational_judgement_rating" as const,
  };
  const snapshot = snapshotQuestionResponse(sj, "b");
  assert.equal(
    evaluatePersistedQuestionResponse(sj, snapshot).score.awarded,
    0.5,
  );
});

test("pending answers survive reconnection without replacing server timing or navigation", () => {
  const server = initialSnapshot({
    sourceType: "questionStem",
    sourceId: "session",
    title: "Practice",
    questions: [question],
    instructionsScreens: [],
  });
  const answer = snapshotQuestionResponse(question, "a");
  const local = {
    ...server,
    currentIndex: 99,
    phase: "review" as const,
    responseSnapshots: { q1: answer },
    flaggedIds: ["q1"],
  };
  const restored = restoreDraft(
    server,
    "attempt-1",
    serializeDraft("attempt-1", local),
  );
  assert.equal(restored.currentIndex, server.currentIndex);
  assert.equal(restored.phase, server.phase);
  assert.deepEqual(restored.responseSnapshots?.q1, answer);
  assert.deepEqual(restored.flaggedIds, ["q1"]);
});

test("a retaken set cannot inherit an older attempt's pending answers", () => {
  const server = initialSnapshot({
    sourceType: "set",
    sourceId: "same-set",
    title: "Set",
    questions: [question],
    instructionsScreens: [],
  });
  const old = {
    ...server,
    responseSnapshots: { q1: snapshotQuestionResponse(question, "a") },
  };
  assert.equal(
    restoreDraft(server, "new-attempt", serializeDraft("old-attempt", old)),
    server,
  );
  assert.equal(restoreDraft(server, "new-attempt", "damaged JSON"), server);
});
