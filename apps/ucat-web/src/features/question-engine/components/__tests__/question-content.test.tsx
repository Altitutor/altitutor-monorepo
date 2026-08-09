import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { QuestionContent } from "@/features/question-engine/components/question-content";
import type { QuestionItem } from "@/features/question-engine/model/types";

jest.mock("@/features/question-engine/components/rich-content-block", () => ({
  RichContentBlock: ({ plainText }: { plainText?: string }) =>
    plainText ?? null,
}));

const question: QuestionItem = {
  id: "syllogism-1",
  index: 0,
  questionSetId: "set-1",
  stemId: "stem-1",
  sectionName: "Decision Making",
  sectionDisplayColumns: 1,
  stemText: "Stem",
  questionText: "Which conclusions follow?",
  questionType: "syllogism",
  options: [
    { id: "statement-1", index: 0, text: "Statement one" },
    { id: "statement-2", index: 1, text: "Statement two" },
  ],
};

describe("QuestionContent syllogism restoration", () => {
  it("shows a snapshot that arrives after resume hydration", () => {
    const { rerender } = render(
      <QuestionContent
        question={question}
        onSelectOption={() => undefined}
        syllogismSnapshot={undefined}
      />,
    );

    expect(
      screen.getAllByLabelText("Drop Yes or No here")[0],
    ).not.toHaveTextContent("Yes");

    rerender(
      <QuestionContent
        question={question}
        onSelectOption={() => undefined}
        syllogismSnapshot={{ "statement-1": true, "statement-2": false }}
      />,
    );

    expect(
      screen.getAllByLabelText("Drop Yes or No here")[0],
    ).toHaveTextContent("Yes");
    expect(
      screen.getAllByLabelText("Drop Yes or No here")[1],
    ).toHaveTextContent("No");
  });

  it("assigns a Yes token with touch pointer dragging", () => {
    const onChangeSyllogismSnapshot = jest.fn();
    render(
      <QuestionContent
        question={question}
        onSelectOption={() => undefined}
        onChangeSyllogismSnapshot={onChangeSyllogismSnapshot}
      />,
    );

    const target = screen.getAllByLabelText("Drop Yes or No here")[0]!;
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => target,
    });

    fireEvent.pointerDown(screen.getByRole("button", { name: "Yes" }), {
      pointerId: 1,
      pointerType: "touch",
      button: 0,
    });
    fireEvent.pointerUp(window, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 10,
      clientY: 10,
    });

    expect(onChangeSyllogismSnapshot).toHaveBeenLastCalledWith({
      "statement-1": true,
    });
  });

  it("renders Most/Least as physical once-only placement for a canonical drag question", () => {
    const mostLeastQuestion: QuestionItem = {
      ...question,
      id: "most-least",
      questionType: "multiple_choice",
      responseType: "drag_and_drop",
      answerScheme: "situational_judgement_most_least",
      options: [
        { id: "action-a", index: 0, text: "Action A", answerKeyValue: "most" },
        { id: "action-b", index: 1, text: "Action B", answerKeyValue: null },
        { id: "action-c", index: 2, text: "Action C", answerKeyValue: "least" },
      ],
    };
    const onChange = jest.fn();
    render(
      <QuestionContent
        question={mostLeastQuestion}
        onSelectOption={() => undefined}
        onChangeSyllogismSnapshot={onChange}
      />,
    );

    expect(screen.getByRole("button", { name: "Most Appropriate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Least Appropriate" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Yes" })).not.toBeInTheDocument();

    const [firstTarget, secondTarget] = screen.getAllByLabelText(
      "Drop Most Appropriate or Least Appropriate here",
    );
    fireEvent.dragStart(screen.getByRole("button", { name: "Most Appropriate" }), {
      dataTransfer: dataTransfer({
        "ucat-syllogism-choice": "most",
        "ucat-syllogism-source": "",
      }),
    });
    fireEvent.drop(firstTarget!, {
      dataTransfer: dataTransfer({
        "ucat-syllogism-choice": "most",
        "ucat-syllogism-source": "",
      }),
    });
    fireEvent.drop(secondTarget!, {
      dataTransfer: dataTransfer({
        "ucat-syllogism-choice": "most",
        "ucat-syllogism-source": "action-a",
      }),
    });

    expect(onChange).toHaveBeenLastCalledWith({ "action-b": true });
  });
});

function dataTransfer(values: Record<string, string>) {
  return {
    getData: (key: string) => values[key] ?? "",
    setData: jest.fn(),
    effectAllowed: "none",
  };
}
