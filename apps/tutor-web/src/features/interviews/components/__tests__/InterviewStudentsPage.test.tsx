import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { InterviewStudentsPage } from "../InterviewStudentsPage";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), useSearchParams: () => new URLSearchParams() }));
jest.mock("../../hooks/use-interview-students", () => ({ useInterviewStudents: () => ({ data: [{
  id: "student-1", name: "Alex", classIds: [], sessions: [{ id: "session", name: "Medicine", startAt: null, attended: true }],
  mocks: [{ id: "mock-1", title: "Short mock", date: "2026-11-17", score: 3, maximumPoints: 6, released: true, stations: [] },
    { id: "mock-2", title: "Long mock", date: "2026-11-16", score: 9, maximumPoints: 12, released: false, stations: [] }],
}, { id: "student-2", name: "Beth", classIds: [], mocks: [], sessions: [] }], isPending: false, error: null, refetch: jest.fn() }) }));
jest.mock("../../hooks/use-interview-performance-reviews", () => ({ useInterviewReviewWorkspace: () => ({ data: { reviews: [] }, isPending: false }),
  useInterviewReviewCommand: () => ({ mutateAsync: jest.fn() }) }));
jest.mock("../../hooks/use-interviews", () => ({ useInterviewCatalog: () => ({ data: { classes: [] } }) }));
jest.mock("../../hooks/use-interview-access", () => ({ useInterviewAccess: () => ({ data: true }) }));
jest.mock("@/features/quick-filters/components/TutorEntityToolbar", () => ({ TutorEntityToolbar: ({ state, onFiltersChange }: { state: { filters: Record<string, unknown[]> }; onFiltersChange: (filters: Record<string, unknown[]>) => void }) => <input aria-label="Minimum interviews" onChange={(event) => onFiltersChange({ ...state.filters, interviewsMin: [event.target.value] })} /> }));

it("lists eligible students with the equal-weight percentage average and linked mock feedback", () => {
  render(<InterviewStudentsPage />);
  expect(screen.getByText("Alex")).toBeInTheDocument();
  expect(screen.getByText("62.5%")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Short mock.*3 \/ 6/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Long mock.*9 \/ 12/ })).toBeInTheDocument();
});


it("keeps zero-mock students visible until the count filter excludes them", () => {
  render(<InterviewStudentsPage />);
  expect(screen.getByText("Beth")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Minimum interviews" }), { target: { value: "1" } });
  expect(screen.queryByText("Beth")).not.toBeInTheDocument();
  expect(screen.getByText("Alex")).toBeInTheDocument();
});
