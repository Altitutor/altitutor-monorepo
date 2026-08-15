import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PreparationSandboxPage } from "../preparation-sandbox-page";

describe("PreparationSandboxPage", () => {
  it("presents a readable Student journey before the raw diagnostics", () => {
    render(<PreparationSandboxPage />);

    expect(
      screen.getByRole("heading", { name: "Study plan journey preview" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Journey")).toHaveValue("foundations");
    expect(screen.getByLabelText("Journey checkpoint")).toHaveValue(
      "new-student",
    );
    expect(
      screen.getByRole("heading", { name: "Generated 21-day plan" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Learning module").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Targeted Practice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Review").length).toBeGreaterThan(0);
    expect(
      within(screen.getByTestId("journey-preview")).queryByText("module-vr"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Advanced JSON, diagnostics and policy comparison"),
    ).toBeInTheDocument();
  });

  it("moves through fixed journey checkpoints and shows benchmark work", async () => {
    render(<PreparationSandboxPage />);

    fireEvent.change(screen.getByLabelText("Journey checkpoint"), {
      target: { value: "benchmark-ready" },
    });

    await waitFor(() =>
      expect(screen.getAllByText("Ready for first benchmarks").length).toBe(2),
    );
    expect(screen.getByLabelText("Journey checkpoint")).toHaveValue(
      "benchmark-ready",
    );
    expect(screen.getAllByText("Benchmark Set").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Predefined Set").length).toBeGreaterThan(0);
  });
});
