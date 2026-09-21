import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewAnswerLabels } from "../features/skill-trainer/lib/review-answers";

test("mental maths review labels use the numeric answers", () => {
  assert.deepEqual(
    reviewAnswerLabels("mental_maths", {
      answer: 126,
      content: { answer: 126 },
      correct: true,
    }),
    { yours: "126", correct: "126" },
  );
});

test("syllogism review labels use yes and no", () => {
  assert.deepEqual(
    reviewAnswerLabels("quick_syllogism", {
      answer: false,
      content: { answer: true },
      correct: false,
    }),
    { yours: "No", correct: "Yes" },
  );
});

test("find concept review distinguishes a skip from a complete find", () => {
  assert.deepEqual(
    reviewAnswerLabels("find_concept", {
      answer: "skip_concept",
      content: { occurrences: [{ start: 0, end: 4 }] },
      correct: false,
    }),
    {
      yours: "Skipped before finding all occurrences",
      correct: "1 occurrence",
    },
  );
});
