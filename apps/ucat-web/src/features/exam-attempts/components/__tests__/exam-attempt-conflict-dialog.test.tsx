import React from "react";
import { render, screen } from "@testing-library/react";
import { ExamAttemptConflictDialog } from "@/features/exam-attempts/components/exam-attempt-conflict-dialog";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";

jest.mock(
  "@/features/onboarding/hooks/use-question-engine-tutorial-gate",
  () => ({
    buildQuestionEngineTutorialHref: (href: string) => href,
    useQuestionEngineTutorialGate: () => ({ isBlocked: false }),
  }),
);

const activeAttempt = {
  kind: "practice",
  attemptId: "practice-1",
  resourceId: "practice-1",
  label: "Practice · Verbal Reasoning",
  resumeHref: "/exam",
} as ActiveExamAttempt;

describe("ExamAttemptConflictDialog", () => {
  it("uses stacked full-width actions on mobile", () => {
    render(
      <ExamAttemptConflictDialog
        open
        active={activeAttempt}
        pendingLabel="this question set"
        isDiscarding={false}
        onDiscardAndContinue={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass(
      "w-full",
      "sm:w-auto",
    );
    expect(
      screen.getByRole("button", { name: "Discard & start new" }),
    ).toHaveClass("w-full", "sm:w-auto");
    expect(screen.getByRole("button", { name: "Resume current" })).toHaveClass(
      "w-full",
      "sm:w-auto",
    );
    expect(
      document.querySelector('[data-slot="alert-dialog-content"]'),
    ).toHaveClass("z-[70]");
  });
});
