import React, { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QuestionContent } from "@/features/question-engine/components/question-content";
import type { QuestionItem } from "@/features/question-engine/model/types";

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly pointerType: string;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
    this.pointerType = init.pointerType ?? "";
  }
}

Object.defineProperty(window, "PointerEvent", {
  configurable: true,
  writable: true,
  value: TestPointerEvent,
});
Object.defineProperty(global, "PointerEvent", {
  configurable: true,
  writable: true,
  value: TestPointerEvent,
});

jest.mock("@/features/question-engine/components/rich-content-block", () => ({
  RichContentBlock: ({ plainText }: { plainText?: string }) =>
    plainText ?? null,
}));

const question: QuestionItem = {
  id: "placement-1",
  index: 0,
  questionSetId: "set-1",
  stemId: "stem-1",
  sectionName: "Decision Making",
  sectionDisplayColumns: 1,
  stemText: "Stem",
  questionText: "Which conclusions follow?",
  responseType: "drag_and_drop",
  answerScheme: "decision_making_binary_placement",
  options: [
    { id: "statement-1", index: 0, text: "Statement one" },
    { id: "statement-2", index: 1, text: "Statement two" },
  ],
};

describe("QuestionContent placement restoration", () => {
  it("shows a snapshot that arrives after resume hydration", () => {
    const { rerender } = render(
      <QuestionContent
        question={question}
        onSelectOption={() => undefined}
        placementSnapshot={undefined}
      />,
    );

    expect(
      screen.getAllByLabelText("Drop Yes or No here")[0],
    ).not.toHaveTextContent("Yes");

    rerender(
      <QuestionContent
        question={question}
        onSelectOption={() => undefined}
        placementSnapshot={{ "statement-1": "yes", "statement-2": "no" }}
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
    const onChangePlacementSnapshot = jest.fn();
    render(
      <QuestionContent
        question={question}
        onSelectOption={() => undefined}
        onChangePlacementSnapshot={onChangePlacementSnapshot}
      />,
    );

    dragYesTokenOntoFirstStatement({ pointerType: "touch" });

    expect(onChangePlacementSnapshot).toHaveBeenLastCalledWith({
      "statement-1": "yes",
    });
  });

  it("assigns a Yes token with mouse pointer dragging", () => {
    const onChangePlacementSnapshot = jest.fn();
    render(
      <QuestionContent
        question={question}
        onSelectOption={() => undefined}
        onChangePlacementSnapshot={onChangePlacementSnapshot}
      />,
    );

    dragYesTokenOntoFirstStatement({ pointerType: "mouse" });

    expect(onChangePlacementSnapshot).toHaveBeenLastCalledWith({
      "statement-1": "yes",
    });
  });

  it("moves a Yes token preview with the pointer during a drag", () => {
    render(
      <QuestionContent question={question} onSelectOption={() => undefined} />,
    );

    dispatchPointer(
      screen.getByRole("button", { name: "Yes" }),
      "pointerdown",
      {
        pointerId: 1,
        pointerType: "touch",
        button: 0,
        clientX: 24,
        clientY: 32,
      },
    );
    dispatchPointer(window, "pointermove", {
      pointerId: 1,
      pointerType: "touch",
      clientX: 180,
      clientY: 90,
    });

    const preview = screen.getByTestId("placement-drag-preview");
    expect(preview).toHaveTextContent("Yes");
    expect(preview).toHaveStyle({ left: "180px", top: "90px" });
  });

  it("renders Most/Least as physical once-only placement for a canonical drag question", () => {
    const mostLeastQuestion: QuestionItem = {
      ...question,
      id: "most-least",
      responseType: "drag_and_drop",
      answerScheme: "situational_judgement_most_least",
      sectionDisplayColumns: 2,
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
        onChangePlacementSnapshot={onChange}
      />,
    );

    expect(screen.getByText("Most Appropriate")).toBeInTheDocument();
    expect(screen.getByText("Least Appropriate")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Yes" }),
    ).not.toBeInTheDocument();

    const mostTarget = screen.getByLabelText(
      "Drop an action into Most Appropriate",
    );
    const leastTarget = screen.getByLabelText(
      "Drop an action into Least Appropriate",
    );
    fireEvent.dragStart(screen.getByText("Action A"), {
      dataTransfer: dataTransfer({
        "ucat-placement-option": "action-a",
      }),
    });
    fireEvent.drop(mostTarget, {
      dataTransfer: dataTransfer({
        "ucat-placement-option": "action-a",
      }),
    });
    expect(mostTarget).toHaveTextContent("Action A");

    fireEvent.drop(leastTarget, {
      dataTransfer: dataTransfer({
        "ucat-placement-option": "action-a",
      }),
    });

    expect(onChange).toHaveBeenLastCalledWith({ "action-a": "least" });
    expect(leastTarget).toHaveTextContent("Action A");
  });

  it("does not update its parent from inside the placement state updater", () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    function StatefulEngineHarness() {
      const [snapshot, setSnapshot] = useState<
        Record<string, "yes" | "no" | "most" | "least">
      >({});
      return (
        <QuestionContent
          question={question}
          onSelectOption={() => undefined}
          placementSnapshot={snapshot}
          onChangePlacementSnapshot={setSnapshot}
        />
      );
    }

    render(<StatefulEngineHarness />);
    const target = screen.getAllByLabelText("Drop Yes or No here")[0]!;
    fireEvent.drop(target, {
      dataTransfer: dataTransfer({
        "ucat-placement-choice": "yes",
        "ucat-placement-source": "",
      }),
    });

    expect(consoleError.mock.calls.flat().map(String).join("\n")).not.toContain(
      "Cannot update a component",
    );
    consoleError.mockRestore();
  });
});

function dispatchPointer(
  target: EventTarget,
  type: "pointerdown" | "pointermove" | "pointerup",
  init: PointerEventInit,
) {
  act(() => {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });
}

function dragYesTokenOntoFirstStatement({
  pointerType,
}: {
  pointerType: "mouse" | "touch";
}) {
  const target = screen.getAllByLabelText("Drop Yes or No here")[0]!;
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => target,
  });

  dispatchPointer(screen.getByRole("button", { name: "Yes" }), "pointerdown", {
    pointerId: 1,
    pointerType,
    button: 0,
  });
  dispatchPointer(window, "pointerup", {
    pointerId: 1,
    pointerType,
    clientX: 10,
    clientY: 10,
  });
}

function dataTransfer(values: Record<string, string>) {
  return {
    getData: (key: string) => values[key] ?? "",
    setData: jest.fn(),
    effectAllowed: "none",
  };
}
