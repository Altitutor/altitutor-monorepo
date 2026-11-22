import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { InterviewRound, TutorInterviewRoundSummary } from "@altitutor/shared";
import { InterviewRoundsPage } from "../InterviewRoundsPage";

jest.mock("next/navigation", () => ({ useRouter: () => ({ replace: jest.fn() }), useSearchParams: () => new URLSearchParams() }));
jest.mock("@/features/staff/hooks/useStaffQuery", () => ({ useCurrentStaff: jest.fn() }));
jest.mock("../../hooks/use-interview-access", () => ({ useInterviewAccess: jest.fn() }));
jest.mock("@/shared/lib/supabase/auth", () => ({ useAuthStore: () => ({ user: { id: "actor" }, loading: false }) }));
jest.mock("@/shared/lib/supabase/client", () => ({ getSupabaseClient: jest.fn(() => { throw new Error("List and print must not join live sync"); }) }));
jest.mock("@altitutor/ui", () => ({ ...jest.requireActual("@altitutor/ui"), useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/features/quick-filters/components/TutorEntityToolbar", () => ({ TutorEntityToolbar: ({ onSearchChange }: { onSearchChange: (value: string) => void }) => <input aria-label="Search rounds" onChange={(event) => onSearchChange(event.target.value)} /> }));
jest.mock("../InterviewPrintDialog", () => ({ InterviewPrintDialog: ({ round, onClose }: { round: InterviewRound; onClose: () => void }) => <div role="dialog" aria-label="Print prompts">{round.stations.map((station) => <p key={station.id}>{String(station.prompt)}</p>)}<button onClick={onClose}>Close print</button></div> }));

const summary: TutorInterviewRoundSummary = {
  id: "round-1", version: 4, createdBy: "actor", createdAt: "2026-11-20T00:00:00Z", updatedAt: "2026-11-20T00:00:00Z",
  interviewId: "interview", name: "Monday circuit", delivery: "online", mode: "exam", recordingEnabled: true,
  scheduledAt: "2026-11-23T09:00:00Z", startedAt: null, phase: "waiting", readingTimeSeconds: 60, questionTimeSeconds: 90,
  rotationAllowanceSeconds: 120, studentIds: ["student"], assignments: [{ stationId: "station", tutorId: "actor" }],
  students: [{ id: "student", name: "Alex" }], tutors: [{ id: "actor", name: "Jordan" }], stationCount: 13, releasedResultCount: 0,
};

function listResponse(url: URL) {
  if (url.searchParams.get("collection") === "current") return { rounds: [summary], history: [] };
  if (url.searchParams.get("collection") === "history") return { rounds: [], nextCursor: null };
  return [summary];
}

it.each([false, true])("reviews a started round's saved work and respects participant presence (%s)", async (present) => {
  const started = { ...summary, startedAt: "2026-11-23T09:00:00Z", phase: "feedback" as const };
  const detail = {
    ...started, rotation: 0, progress: [], connectedStudentIds: [], connectedTutorIds: present ? ["actor"] : [],
    phaseStartedAt: null, phaseDeadline: null, pausedAt: null, pausedBy: null,
    remainingMilliseconds: null, releasedResults: [], recordings: [],
    stations: [{ id: "station", name: "Communication", maximumPoints: 6, prompt: "Scenario", questions: [{ id: "question", questionId: "question", question: "What would you do?", rubric: "", rubricVersion: 1, tagIds: [] }] }],
    attempts: [{ id: "attempt", studentId: "student", stationId: "station", version: 9, score: 0, notAssessedReason: null,
      generalFeedback: "Introduce yourself before answering.", feedback: [{ placementId: "question", value: "Explain your reasoning." }],
      completed: false, updatedAt: "2026-11-23T09:05:00Z", updatedBy: "actor" }],
  };
  detail.releasedResults = [{ studentId: "student", revision: 1, attempts: [{ ...detail.attempts[0], score: 4,
    generalFeedback: "Previously published advice." }] }] as unknown as typeof detail.releasedResults;
  let deleted = false;
  const commands: unknown[] = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "https://portal.test");
    let body: unknown;
    if (url.pathname.endsWith("/commands")) {
      commands.push(JSON.parse(String(init?.body)) as unknown); deleted = true; body = { id: "round-1", version: 5 };
    } else if (url.pathname.endsWith("/catalog")) body = { actorId: "actor", interviews: [], students: [], tutors: [] };
    else if (url.pathname.endsWith("/rounds")) body = url.searchParams.get("collection") === "current"
      ? { rounds: deleted ? [] : [started], history: [] } : { rounds: [], nextCursor: null };
    else body = detail;
    return { ok: true, json: async () => body } as Response;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><InterviewRoundsPage /></QueryClientProvider>);
  try {
    await screen.findByText("Monday circuit");
    fireEvent.keyDown(screen.getByRole("button", { name: "Row actions" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete round" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(await within(dialog).findByText("Introduce yourself before answering.")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Explain your reasoning.")).toHaveLength(2);
    expect(within(dialog).getByText("0 / 6")).toBeInTheDocument();
    expect(within(dialog).getByText("Previously published advice.")).toBeInTheDocument();
    expect(within(dialog).getByText("4 / 6")).toBeInTheDocument();
    expect(commands).toEqual([]);
    if (present) {
      expect(within(dialog).getByRole("status")).toHaveTextContent("Jordan");
      expect(within(dialog).getByRole("button", { name: "Delete round" })).toBeDisabled();
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      expect(commands).toEqual([]);
      return;
    }
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete round" }));
    await waitFor(() => expect(screen.queryByText("Monday circuit")).not.toBeInTheDocument());
    expect(commands).toEqual([expect.objectContaining({ type: "deleteRound", roundId: "round-1", expectedVersion: 4,
      expectedAttemptVersions: [{ id: "attempt", version: 9 }] })]);
  } finally { view.unmount(); client.clear(); }
});

it("keeps the tutor roster searchable and loads full print prompts only after Print is selected", async () => {
  const detailReads = jest.fn().mockResolvedValue({ ...summary, stations: [{ id: "station", prompt: "Private station prompt" }] });
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "https://portal.test");
    const path = url.pathname;
    if (path === "/api/interviews/rounds" || path === "/api/interviews/catalog") expect(url.searchParams.get("summary")).toBe("1");
    const body = path.endsWith("/catalog") ? { actorId: "actor", interviews: [{ id: "interview", name: "Medicine" }], students: [], tutors: [] }
      : path.endsWith("/rounds") ? listResponse(url) : await detailReads();
    return { ok: true, json: async () => body } as Response;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><InterviewRoundsPage /></QueryClientProvider>);
  try {
    expect(await screen.findByText("Monday circuit")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Jordan")).toBeInTheDocument();
    expect(detailReads).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Search rounds" }), { target: { value: "Missing" } });
    expect(screen.queryByText("Monday circuit")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search rounds" }), { target: { value: "Medicine" } });
    expect(screen.getByText("Monday circuit")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Row actions" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Print prompts" }));
    expect(await screen.findByRole("dialog", { name: "Print prompts" })).toHaveTextContent("Private station prompt");
    expect(detailReads).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close print" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Print prompts" })).not.toBeInTheDocument());
    expect(detailReads).toHaveBeenCalledTimes(1);
  } finally { view.unmount(); client.clear(); }
});


it("lets a tutor dismiss slow print loading without opening the dialog when the read eventually finishes", async () => {
  let finishRead!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => { finishRead = resolve; });
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "https://portal.test");
    const path = url.pathname;
    if (path === "/api/interviews/rounds") expect(url.searchParams.get("summary")).toBe("1");
    if (!path.endsWith("/catalog") && !path.endsWith("/rounds")) return pending;
    const body = path.endsWith("/catalog") ? { actorId: "actor", interviews: [], students: [], tutors: [] } : listResponse(url);
    return { ok: true, json: async () => body } as Response;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><InterviewRoundsPage /></QueryClientProvider>);
  try {
    await screen.findByText("Monday circuit");
    fireEvent.keyDown(screen.getByRole("button", { name: "Row actions" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Print prompts" }));
    expect(screen.getByRole("status")).toHaveTextContent("Loading print prompts");
    fireEvent.click(screen.getByRole("button", { name: "Cancel printing" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    finishRead({ ok: true, json: async () => ({ ...summary, stations: [] }) } as Response);
    await waitFor(() => expect(client.getQueryData(["interviews", "round", "round-1", "actor"])).toBeDefined());
    expect(screen.queryByRole("dialog", { name: "Print prompts" })).not.toBeInTheDocument();
  } finally { view.unmount(); client.clear(); }
});

it("withholds cached prompts on reopen until a fresh read succeeds and exposes refresh failure and retry", async () => {
  let finishReopen!: (response: Response) => void;
  let finishRetry!: (response: Response) => void;
  const reopening = new Promise<Response>((resolve) => { finishReopen = resolve; });
  const retrying = new Promise<Response>((resolve) => { finishRetry = resolve; });
  const response = (prompt: string) => ({ ok: true, json: async () => ({ ...summary, stations: [{ id: "station", prompt }] }) }) as Response;
  const detailReads = jest.fn().mockResolvedValueOnce(response("Old print prompt")).mockReturnValueOnce(reopening).mockReturnValueOnce(retrying);
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "https://portal.test");
    const path = url.pathname;
    if (path === "/api/interviews/rounds") expect(url.searchParams.get("summary")).toBe("1");
    if (!path.endsWith("/catalog") && !path.endsWith("/rounds")) return detailReads();
    const body = path.endsWith("/catalog") ? { actorId: "actor", interviews: [], students: [], tutors: [] } : listResponse(url);
    return { ok: true, json: async () => body } as Response;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: 3, staleTime: 5 * 60_000, refetchOnMount: false } } });
  const view = render(<QueryClientProvider client={client}><InterviewRoundsPage /></QueryClientProvider>);
  const openPrint = async () => {
    await act(async () => { fireEvent.keyDown(screen.getByRole("button", { name: "Row actions" }), { key: "Enter" }); });
    const item = await screen.findByRole("menuitem", { name: "Print prompts" });
    await act(async () => { fireEvent.click(item); });
  };
  try {
    await screen.findByText("Monday circuit");
    await openPrint();
    expect(await screen.findByRole("dialog", { name: "Print prompts" })).toHaveTextContent("Old print prompt");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Close print" })); });
    await openPrint();
    await waitFor(() => expect(detailReads).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog", { name: "Print prompts" })).not.toBeInTheDocument();
    expect(screen.queryByText("Old print prompt")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading print prompts");
    expect(screen.getByRole("button", { name: "Cancel printing" })).toBeInTheDocument();
    await act(async () => { finishReopen({ ok: false, status: 503, json: async () => ({ error: "Print refresh unavailable" }) } as Response); });
    expect(await screen.findByText("Print refresh unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Old print prompt")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel printing" })).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Try again" })); });
    await waitFor(() => expect(detailReads).toHaveBeenCalledTimes(3));
    expect(screen.getByRole("status")).toHaveTextContent("Loading print prompts");
    expect(screen.queryByRole("dialog", { name: "Print prompts" })).not.toBeInTheDocument();
    await act(async () => { finishRetry(response("Fresh print prompt")); });
    expect(await screen.findByRole("dialog", { name: "Print prompts" })).toHaveTextContent("Fresh print prompt");
    expect(screen.queryByText("Old print prompt")).not.toBeInTheDocument();
    expect(detailReads).toHaveBeenCalledTimes(3);
  } finally { view.unmount(); client.clear(); }
});
