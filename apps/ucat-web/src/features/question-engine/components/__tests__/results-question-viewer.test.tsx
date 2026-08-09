import React from "react";
import { render, screen } from "@testing-library/react";
import { ResultsQuestionViewer } from "@/features/question-engine/components/results-question-viewer";
import type { QuestionItem } from "@/features/question-engine/model/types";

jest.mock("@/features/question-engine/components/rich-content-block", () => ({
  RichContentBlock: ({ plainText }: { plainText?: string }) => plainText ?? null,
}));

const question: QuestionItem = {
  id: "most-least-results",
  index: 0,
  questionSetId: "set-1",
  stemId: "stem-1",
  sectionName: "Situational Judgement",
  sectionDisplayColumns: 1,
  stemText: "Scenario",
  questionText: "Choose the destinations.",
  questionType: "multiple_choice",
  responseType: "drag_and_drop",
  answerScheme: "situational_judgement_most_least",
  options: [
    { id: "a", index: 0, text: "Action A", answerKeyValue: "most" },
    { id: "b", index: 1, text: "Action B", answerKeyValue: null },
    { id: "c", index: 2, text: "Action C", answerKeyValue: "least" },
  ],
};

describe("ResultsQuestionViewer placement review", () => {
  it("shows both Most/Least destinations and the unplaced middle action", () => {
    render(
      <ResultsQuestionViewer
        question={question}
        syllogismSnapshot={{ a: true, c: false }}
        points={8}
      />,
    );

    expect(screen.getAllByText("Most Appropriate").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Least Appropriate").length).toBeGreaterThan(0);
    expect(screen.getByText("Not placed")).toBeInTheDocument();
  });
});
