import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { StudyPlanGoalFields } from "@/features/study-plan/components/study-plan-setup-ui";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  value: ResizeObserverMock,
  writable: true,
});

const yearOptions = [{ year: 2026 }, { year: 2027 }];

describe("StudyPlanGoalFields", () => {
  it("lays out year, optional date, and working target as labelled rows", () => {
    render(
      <StudyPlanGoalFields
        idPrefix="goal-setup"
        targetScore={2200}
        targetUnsure={false}
        testYear={2026}
        testDate=""
        yearOptions={yearOptions}
        onTargetScoreChange={jest.fn()}
        onTargetUnsure={jest.fn()}
        onTestYearChange={jest.fn()}
        onTestDateChange={jest.fn()}
      />,
    );

    expect(screen.getByText("UCAT year")).toBeInTheDocument();
    expect(screen.getByText("Exact date (optional)")).toBeInTheDocument();
    expect(screen.getByText("Target score")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "UCAT year" })).toHaveClass(
      "w-full",
    );
    expect(
      screen.getByRole("spinbutton", { name: "Target UCAT score" }),
    ).toHaveValue(2200);
    expect(
      screen.getByRole("slider", { name: "Adjust target UCAT score" }),
    ).toHaveValue("2200");
  });

  it("hides the exact date until a UCAT year is chosen", () => {
    render(
      <StudyPlanGoalFields
        idPrefix="goal-setup"
        targetScore={2200}
        targetUnsure={false}
        testYear={null}
        testDate=""
        yearOptions={yearOptions}
        onTargetScoreChange={jest.fn()}
        onTargetUnsure={jest.fn()}
        onTestYearChange={jest.fn()}
        onTestDateChange={jest.fn()}
      />,
    );

    expect(
      screen.queryByLabelText("Exact date (optional)"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Exact date (optional)")).not.toBeInTheDocument();
  });

  it("fills a working target of 2200 when the student is unsure", () => {
    const onTargetUnsure = jest.fn();
    render(
      <StudyPlanGoalFields
        idPrefix="goal-setup"
        targetScore={2200}
        targetUnsure={false}
        testYear={null}
        testDate=""
        yearOptions={yearOptions}
        onTargetScoreChange={jest.fn()}
        onTargetUnsure={onTargetUnsure}
        onTestYearChange={jest.fn()}
        onTestDateChange={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Not sure what to set?" }));
    expect(onTargetUnsure).toHaveBeenCalledTimes(1);
  });
});
