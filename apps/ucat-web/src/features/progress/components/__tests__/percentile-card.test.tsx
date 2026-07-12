import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { PercentileCard } from "../percentile-card";

describe("PercentileCard", () => {
  it("shows the student's percentile and lets them explore then reset", () => {
    render(<PercentileCard scaledScore={700} scope="section" />);

    expect(screen.getByText("80th percentile")).toBeInTheDocument();
    expect(screen.getByText("Score 700 · 80%")).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText("Explore scores on the percentile distribution"),
      { target: { value: "600" } },
    );

    expect(screen.getByText("Score 600 · 50%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "My score" }));
    expect(screen.getByText("Score 700 · 80%")).toBeInTheDocument();
  });

  it("shows an empty state without an interactive chart", () => {
    render(<PercentileCard scaledScore={null} scope="section" />);

    expect(
      screen.getByText("Complete an attempt to see how your score compares."),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Explore scores on the percentile distribution"),
    ).not.toBeInTheDocument();
  });
});
