import React from "react";
import { render, screen, within } from "@testing-library/react";
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
  it("reviews Most/Least by destination, matching the answering interaction", () => {
    render(
      <ResultsQuestionViewer
        question={question}
        syllogismSnapshot={{ a: false, c: true }}
        points={0}
      />,
    );

    expect(screen.getByText("Destination")).toBeInTheDocument();
    const mostRow = screen.getByTestId("placement-destination-most");
    expect(within(mostRow).getByText("Most Appropriate")).toBeInTheDocument();
    expect(within(mostRow).getByText("Action C")).toBeInTheDocument();
    expect(within(mostRow).getByText("Action A")).toBeInTheDocument();

    const leastRow = screen.getByTestId("placement-destination-least");
    expect(within(leastRow).getByText("Least Appropriate")).toBeInTheDocument();
    expect(within(leastRow).getByText("Action A")).toBeInTheDocument();
    expect(within(leastRow).getByText("Action C")).toBeInTheDocument();

    const unplacedRow = screen.getByTestId("placement-destination-not-placed");
    expect(within(unplacedRow).getByText("Not placed")).toBeInTheDocument();
    expect(within(unplacedRow).getAllByText("Action B")).toHaveLength(2);
  });
});
