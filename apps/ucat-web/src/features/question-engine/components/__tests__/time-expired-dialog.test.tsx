import React from "react";
import { render, screen } from "@testing-library/react";
import { TimeExpiredDialog } from "@/features/question-engine/components/time-expired-dialog";

jest.mock(
  "@/features/question-engine/components/question-engine-dialog",
  () => ({
    QuestionEngineDialog: ({
      title,
      message,
    }: {
      title: string;
      message: React.ReactNode;
    }) => (
      <div>
        <h1>{title}</h1>
        {message}
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
        "Your practice time has run out. Click OK to review your answers.",
      ),
    ).toBeInTheDocument();
  });
});
