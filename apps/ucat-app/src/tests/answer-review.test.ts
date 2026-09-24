import test from "node:test";
import assert from "node:assert/strict";
import {
  answerOptionReview,
  hasReviewedAnswer,
} from "../features/question-engine/lib/answer-review";
import type { ReviewContract } from "@altitutor/ucat-response-contract";

test("single choice review marks your wrong answer separately from the correct answer", () => {
  const review: ReviewContract = {
    kind: "single_select",
    selectedOptionId: "a",
    correctOptionId: "b",
    outcome: "incorrect",
  };
  assert.deepEqual(answerOptionReview(review, "a"), {
    tone: "incorrect",
    badges: [{ label: "Your answer", tone: "incorrect" }],
  });
  assert.deepEqual(answerOptionReview(review, "b"), {
    tone: "correct",
    badges: [{ label: "Correct answer", tone: "correct" }],
  });
  assert.deepEqual(
    answerOptionReview(
      { ...review, selectedOptionId: "b", outcome: "correct" },
      "b",
    ).badges.map((badge) => badge.label),
    ["Your answer", "Correct answer"],
  );
});

test("blank answers remain distinguishable from a partially answered binary question", () => {
  const review: ReviewContract = {
    kind: "placement",
    outcome: "unanswered",
    rows: [
      {
        targetId: "a",
        placedToken: null,
        correctToken: "yes",
        outcome: "unanswered",
      },
      {
        targetId: "b",
        placedToken: "yes",
        correctToken: "no",
        outcome: "incorrect",
      },
    ],
  };
  // An overall marking outcome of unanswered can still contain a wrong selection.
  assert.equal(hasReviewedAnswer(review), true);
  assert.deepEqual(
    answerOptionReview(review, "a").badges.map((badge) => badge.label),
    ["Not answered", "Correct answer: Yes"],
  );
  assert.equal(
    hasReviewedAnswer({
      kind: "single_select",
      selectedOptionId: null,
      correctOptionId: "a",
      outcome: "unanswered",
    }),
    false,
  );
});

test("most/least neutral options aren't incorrectly labelled unanswered", () => {
  const review: ReviewContract = {
    kind: "placement",
    outcome: "incorrect",
    rows: [
      {
        targetId: "a",
        placedToken: null,
        correctToken: null,
        outcome: "unanswered",
      },
      {
        targetId: "b",
        placedToken: "least",
        correctToken: "most",
        outcome: "incorrect",
      },
      {
        targetId: "c",
        placedToken: "most",
        correctToken: null,
        outcome: "incorrect",
      },
    ],
  };
  assert.deepEqual(answerOptionReview(review, "a"), {
    badges: [],
    tone: "neutral",
  });
  assert.deepEqual(answerOptionReview(review, "b"), {
    tone: "incorrect",
    badges: [
      { label: "Your answer: Least appropriate", tone: "incorrect" },
      { label: "Correct answer: Most appropriate", tone: "correct" },
    ],
  });
  assert.equal(answerOptionReview(review, "c").tone, "incorrect");
});
