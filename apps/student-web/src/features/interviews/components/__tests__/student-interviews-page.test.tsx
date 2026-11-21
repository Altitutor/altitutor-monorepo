import React from "react";
import { render, screen } from "@testing-library/react";
import type { StudentInterviewRoundSummary } from "@altitutor/shared";
import { StudentInterviewsPage } from "../student-interviews-page";
import {
  useInterviewAccess,
  useInterviewRounds,
} from "../../hooks/use-interviews";

jest.mock("@altitutor/ui", () => ({
  ...jest.requireActual("@altitutor/ui/components/button"),
  ...jest.requireActual("@altitutor/ui/components/badge"),
}));
jest.mock("../../hooks/use-interviews", () => ({
  useInterviewAccess: jest.fn(),
  useInterviewRounds: jest.fn(),
}));

function round(
  overrides: Partial<StudentInterviewRoundSummary>,
): StudentInterviewRoundSummary {
  return {
    id: "round-1",
    name: "Medicine practice",
    version: 1,
    delivery: "online",
    mode: "exam",
    recordingEnabled: false,
    scheduledAt: null,
    startedAt: "2026-10-23T10:00:00Z",
    phase: "reading",
    stationCount: 1,
    hasReleasedResults: false,
    ...overrides,
  };
}

describe("student interview list", () => {
  it("offers join only for online interviews", () => {
    jest.mocked(useInterviewAccess).mockReturnValue({
      isPending: false,
      error: null,
      data: { hasAccess: true },
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useInterviewAccess>);
    jest.mocked(useInterviewRounds).mockReturnValue({
      isPending: false,
      error: null,
      data: [
        round({ id: "online", name: "Online circuit", delivery: "online" }),
        round({
          id: "in-person",
          name: "Campus circuit",
          delivery: "in_person",
        }),
      ],
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useInterviewRounds>);
    render(<StudentInterviewsPage />);
    expect(
      screen.getByRole("link", { name: "Rejoin interview" }),
    ).toHaveAttribute("href", "/interviews/rounds/online");
    expect(screen.getByText("Campus circuit")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Enter waiting room" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /interview/i })).toHaveLength(1);
  });
});

it("renders station counts and released-result links from summaries without rich round bodies", () => {
  jest.mocked(useInterviewAccess).mockReturnValue({ isPending: false, error: null, data: { hasAccess: true } } as unknown as ReturnType<typeof useInterviewAccess>);
  jest.mocked(useInterviewRounds).mockReturnValue({ isPending: false, error: null, data: [{
    id: "summary-round", name: "Summary circuit", version: 3, delivery: "online", mode: "exam",
    recordingEnabled: true, scheduledAt: null, startedAt: "2026-11-20T00:00:00Z", phase: "completed",
    stationCount: 13, hasReleasedResults: true,
  }] } as unknown as ReturnType<typeof useInterviewRounds>);
  render(<StudentInterviewsPage />);
  expect(screen.getByText("13 stations")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View results" })).toHaveAttribute("href", "/interviews/rounds/summary-round/results");
});
