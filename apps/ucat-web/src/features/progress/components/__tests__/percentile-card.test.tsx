import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { PercentileCard } from "../percentile-card";

describe("PercentileCard", () => {
  it("shows the student's percentile and resets after hover exploration", () => {
    render(<PercentileCard scaledScore={700} scope="section" />);

    expect(screen.getByText("80th")).toBeInTheDocument();
    expect(screen.getByText("Score 700 · 80th percentile")).toBeInTheDocument();

    const curve = screen.getByRole("img");
    jest.spyOn(curve, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 100,
      top: 0,
      right: 100,
      bottom: 58,
      height: 58,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.mouseMove(curve, { clientX: 50 });

    expect(screen.getByText("Score 600 · 50th percentile")).toBeInTheDocument();
    fireEvent.mouseLeave(curve);
    expect(screen.getByText("Score 700 · 80th percentile")).toBeInTheDocument();
  });

  it("shows an empty state without an interactive chart", () => {
    render(<PercentileCard scaledScore={null} scope="section" />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Percentile explanation"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
