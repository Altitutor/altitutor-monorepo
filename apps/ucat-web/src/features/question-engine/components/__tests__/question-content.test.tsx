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
});
