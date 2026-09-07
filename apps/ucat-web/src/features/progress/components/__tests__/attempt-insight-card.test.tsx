import React from "react";
import { render, screen } from "@testing-library/react";
import { AttemptInsightCard } from "../attempt-insight-card";
import type { WrongAnswerInsightItem } from "../../lib/question-insight-evidence";

jest.mock("@/features/content-ratings/components/content-rating-controls", () => ({
  ContentRatingControls: () => null,
}));

jest.mock("@/features/question-engine/components/rich-content-block", () => ({
  RichContentBlock: ({ plainText }: { plainText?: string }) =>
    plainText ?? null,
}));

const insight = {
  ruleId: "question.incorrect_balanced" as const,
  title: "Your timing was fine — the reasoning needs work",
  body: "You used about the same amount of time as students who got this question right. Use the explanation to find where your reasoning diverged.",
  tone: "coaching" as const,
};

describe("AttemptInsightCard question insight", () => {
  it("keeps the generic description when the chosen answer has no explanation", () => {
    render(
      <AttemptInsightCard
        label="Question insight"
        insight={insight}
        ratingContextKey="preview"
      />,
    );

    expect(
      screen.getByText("Your timing was fine — the reasoning needs work"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Use the explanation to find where your reasoning diverged/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Incorrect")).not.toBeInTheDocument();
  });

  it("replaces the description with the chosen answer and its explanation", () => {
    const wrongAnswerItems: WrongAnswerInsightItem[] = [
      {
        kind: "single_select",
        letter: "D",
        option: {
          id: "option-d",
          index: 3,
          text: "Cold Claire sells vanilla ice cream",
          answerExplanation:
            "Cold Claire sells chocolate, not vanilla.",
        },
      },
    ];

    render(
      <AttemptInsightCard
        label="Question insight"
        insight={insight}
        wrongAnswerItems={wrongAnswerItems}
        ratingContextKey="preview"
      />,
    );

    expect(screen.getByText("Incorrect")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByText("D.")).toBeInTheDocument();
    expect(
      screen.getByText("Cold Claire sells vanilla ice cream"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Cold Claire sells chocolate, not vanilla."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Use the explanation to find where your reasoning diverged/),
    ).not.toBeInTheDocument();
  });

  it("shows every wrong drag-and-drop answer with the token the student chose", () => {
    const wrongAnswerItems: WrongAnswerInsightItem[] = [
      {
        kind: "placement",
        chosenTokenLabel: "Yes",
        option: {
          id: "option-b",
          index: 1,
          text: "Statement B",
          answerExplanation: "B assumes a fact that was not provided.",
        },
      },
      {
        kind: "placement",
        chosenTokenLabel: "No",
        option: {
          id: "option-c",
          index: 2,
          text: "Statement C",
          answerExplanation: "C contradicts the final condition.",
        },
      },
    ];

    render(
      <AttemptInsightCard
        label="Question insight"
        insight={insight}
        wrongAnswerItems={wrongAnswerItems}
        ratingContextKey="preview"
      />,
    );

    expect(screen.getAllByText("Incorrect")).toHaveLength(2);
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(
      screen.getByText("B assumes a fact that was not provided."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("C contradicts the final condition."),
    ).toBeInTheDocument();
  });

  it("puts the drag-and-drop question explanation above the missed options", () => {
    render(
      <AttemptInsightCard
        label="Question insight"
        insight={insight}
        questionExplanation={{
          text: "Judge each statement only against the notes.",
        }}
        wrongAnswerItems={[
          {
            kind: "placement",
            chosenTokenLabel: "Yes",
            option: {
              id: "option-b",
              index: 1,
              text: "Statement B",
              answerExplanation: "B assumes a fact that was not provided.",
            },
          },
        ]}
        ratingContextKey="preview"
      />,
    );

    expect(
      screen.getByText("Judge each statement only against the notes."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("B assumes a fact that was not provided."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Use the explanation to find where your reasoning diverged/),
    ).not.toBeInTheDocument();
  });

  it("links related lessons under the insight", () => {
    render(
      <AttemptInsightCard
        label="Question insight"
        insight={insight}
        ratingContextKey="preview"
        remediationLessons={[
          {
            id: "lesson-1",
            title: "Must be true vs could be true",
            href: "/learn/sections/2/lesson-1",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Must be true vs could be true" }),
    ).toHaveAttribute("href", "/learn/sections/2/lesson-1");
  });
});
