import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { PercentileCard } from "../percentile-card";

const percentile = {
  status: "available" as const,
  percentile: 80,
  cohortSize: 20,
  minimumCohortSize: 20,
  targetScore: 700,
  bins: [
    { score: 500, count: 8 },
    { score: 600, count: 4 },
    { score: 700, count: 8 },
  ],
};

describe("PercentileCard", () => {
  it("shows the student's percentile and resets after hover exploration", () => {
    render(
      <PercentileCard
        scaledScore={700}
        percentile={percentile}
        scope="set"
      />,
    );

    expect(screen.getByText("80th percentile")).toBeInTheDocument();
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
    render(
      <PercentileCard
        scaledScore={600}
        scope="set"
        percentile={{
          status: "insufficient_data",
          cohortSize: 8,
          minimumCohortSize: 20,
          targetScore: 600,
          bins: [{ score: 600, count: 8 }],
        }}
      />,
    );

    expect(screen.getByText("Not enough data yet")).toBeInTheDocument();
    expect(screen.getByText("8 of 20 eligible first attempts so far.")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Percentile explanation"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
