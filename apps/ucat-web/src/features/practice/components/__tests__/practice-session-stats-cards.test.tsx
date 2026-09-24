import React from "react";
import { render, screen } from "@testing-library/react";
import { PracticeSessionStatsCards } from "@/features/practice/components/practice-session-page";

jest.mock("@/features/onboarding/config/tour-steps", () => ({
  UCAT_QUESTION_ENGINE_TOUR: "ucat-question-engine-intro",
}));

jest.mock("@/features/question-engine", () => ({
  QuestionEnginePage: () => null,
}));

const stats = {
  answeredCount: 8,
  correctCount: 5,
  incorrectCount: 3,
  revealAccuracy: true,
  totalAnsweredTimeSeconds: 40,
  currentQuestionNumber: 9,
  totalQuestionLabel: "Unlimited",
  timingPhase: "question" as const,
  stemTimeSeconds: 4,
  stemQuestionTimes: [],
};

describe("PracticeSessionStatsCards", () => {
  it("hides the entire answer card when review is deferred until the end", () => {
    render(
      <PracticeSessionStatsCards
        stats={{ ...stats, revealAccuracy: false }}
        elapsedSeconds={60}
        showAnswerStats={false}
      />,
    );

    expect(screen.queryByText("Answers")).not.toBeInTheDocument();
    expect(screen.queryByText("Answered")).not.toBeInTheDocument();
    expect(screen.getByText("Timing")).toBeInTheDocument();
  });

  it("shows answer accuracy when reviewing as the student goes", () => {
    render(
      <PracticeSessionStatsCards
        stats={stats}
        elapsedSeconds={60}
        showAnswerStats
      />,
    );

    expect(screen.getByText("Answers")).toBeInTheDocument();
    expect(screen.getByText("Answered")).toBeInTheDocument();
    expect(screen.getByText("Correct")).toBeInTheDocument();
    expect(screen.getByText("Incorrect")).toBeInTheDocument();
  });
});
