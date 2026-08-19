import React from "react";
import { render, screen } from "@testing-library/react";
import { TimeExpiredDialog } from "@/features/question-engine/components/time-expired-dialog";

jest.mock("@altitutor/ui", () => ({
  UcatExamActionButton: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

jest.mock(
  "@/features/question-engine/components/question-engine-dialog",
  () => ({
    QuestionEngineDialog: ({
      title,
      message,
      actions,
    }: {
      title: string;
      message: React.ReactNode;
      actions: React.ReactNode;
    }) => (
      <div>
        <h1>{title}</h1>
        {message}
        {actions}
      </div>
    ),
  }),
);

describe("TimeExpiredDialog", () => {
  it("sends session-timed practice directly to review", () => {
    render(
      <TimeExpiredDialog onOk={jest.fn()} isPracticeMode practiceReviewAtEnd />,
    );

    expect(
      screen.getByText(
        "Your practice time has run out. Review your answers when you're ready.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review answers" }),
    ).toBeInTheDocument();
  });
});
