import React from "react";
import { render, screen } from "@testing-library/react";
import type { StudentInterviewRound } from "@altitutor/shared";
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
  overrides: Partial<StudentInterviewRound>,
): StudentInterviewRound {
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
    rotation: 0,
    pausedAt: null,
    phaseStartedAt: "2026-10-23T10:00:00Z",
    phaseDeadline: null,
    serverNow: "2026-10-23T10:00:00Z",
    studentId: "student-1",
    stationId: "station-1",
    stationNumber: 1,
    tutor: null,
    prompt: "",
    endedEarly: false,
    stations: [{ id: "station-1", number: 1, complete: false }],
    result: null,
    resultStations: [],
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
