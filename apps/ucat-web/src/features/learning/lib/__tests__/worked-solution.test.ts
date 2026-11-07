import type { LearningModuleBlockRow } from "@/features/learning/types";
import { hasSubmittedLessonQuestion, isWorkedSolutionAfterQuestion } from "../worked-solution";

const baseBlock: LearningModuleBlockRow = {
  block_completed_at: null,
  block_type: "question_stem",
  content: null,
  file_id: null,
  id: "question",
  index: 0,
  interaction_state: null,
  learning_module_id: "lesson",
  manually_completed: null,
  question_id: null,
  question_stem_id: "stem",
  require_completion_before_next: false,
  skill_trainer_id: null,
};

function textBlock(heading: string): LearningModuleBlockRow {
  return {
    ...baseBlock,
    id: "text",
    block_type: "text",
    question_stem_id: null,
    content: {
      body: {
        type: "doc",
        content: [{ type: "heading", content: [{ type: "text", text: heading }] }],
      },
    },
  };
}

describe("worked-solution visibility in learning lessons", () => {
  it.each([
    "What to notice from the Bellhaven passage",
    "What to notice and quick summary",
    "Feedback",
    "Feedback: urgency and scope",
    "Feedback and takeaways",
    "Review the reasoning",
    "Worked solution",
  ])("recognizes %s immediately after a question or stem", (heading) => {
    expect(isWorkedSolutionAfterQuestion(textBlock(heading), baseBlock)).toBe(true);
    expect(isWorkedSolutionAfterQuestion(
      textBlock(heading),
      { ...baseBlock, block_type: "question" },
    )).toBe(true);
  });

  it.each(["Quick summary", "Worked example", "Take it into the test"])(
    "leaves %s readable even after a question",
    (heading) => {
      expect(isWorkedSolutionAfterQuestion(textBlock(heading), baseBlock)).toBe(false);
    },
  );

  it("leaves feedback readable when there is no preceding question block", () => {
    expect(isWorkedSolutionAfterQuestion(textBlock("Feedback"), textBlock("Topic"))).toBe(false);
    expect(isWorkedSolutionAfterQuestion(textBlock("Feedback"), undefined)).toBe(false);
  });

  it("distinguishes a submitted question from manual lesson completion", () => {
    const manuallyCompleted = {
      ...baseBlock,
      block_completed_at: "2026-11-06T00:00:00Z",
      manually_completed: true,
    };
    expect(hasSubmittedLessonQuestion(manuallyCompleted)).toBe(false);
    expect(hasSubmittedLessonQuestion({
      ...manuallyCompleted,
      interaction_state: { completedFromQuestionEngine: true },
    })).toBe(true);
  });
});
