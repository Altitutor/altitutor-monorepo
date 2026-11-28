import React, {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { InterviewRound } from "@altitutor/shared";
import { InterviewWorkspace } from "../InterviewWorkspace";

let currentRound: InterviewRound;
let catalogueAvailable = true;
const mockMutateAsync = jest.fn();
const mockRefetch = jest.fn();
const mockToast = jest.fn();
const mockFlush = jest.fn();
const mockFinalizeAudio = jest.fn();
const mockLeaveTo = jest.fn();
const mockQuestionSelected = jest.fn();

jest.mock("../../hooks/use-interview-question-timing", () => ({
  useInterviewQuestionTiming: () => ({
    onQuestionSelected: mockQuestionSelected,
    timingError: null,
    retryTiming: jest.fn(),
  }),
}));

jest.mock("../../api/interviews", () => ({
  sendInterviewCommand: jest.fn().mockResolvedValue({}),
}));

jest.mock("../../hooks/use-interview-leave-guard", () => ({
  useInterviewLeaveGuard: () => ({
    open: false,
    requestExit: jest.fn(),
    cancel: jest.fn(),
    leave: jest.fn(),
    leaveTo: mockLeaveTo,
  }),
}));

jest.mock("../../hooks/use-attempt-draft", () => ({
  useAttemptDraft: () => ({
    draft: {
      score: 3,
      generalFeedback: null,
      feedback: [],
      notAssessedReason: null,
    },
    update: jest.fn(),
    flush: mockFlush,
    recoveryUnavailable: true,
    state: "saved",
    error: null,
    newerRevision: false,
    loadSaved: jest.fn(),
    keepDraft: jest.fn(),
  }),
}));

jest.mock("../../hooks/use-interviews", () => ({
  useInterviewRound: () => ({
    data: currentRound,
    actorId: "tutor-1",
    error: null,
    isError: false,
    isPending: false,
    refetch: mockRefetch,
    refreshForAction: async () => {
      const latest = await mockRefetch();
      if (latest.isError || !latest.data) throw new Error("Unable to refresh the round before this action.");
      return latest.data;
    },
    heartbeatFailed: false,
  }),
  useInterviewCatalog: () => ({ data: catalogueAvailable ? { actorId: "tutor-1" } : undefined }),
  useInterviewCommand: () => ({
    isPending: false,
    error: null,
    mutateAsync: mockMutateAsync,
    reset: jest.fn(),
  }),
}));

jest.mock("../interview-ui", () => ({
  ConfirmAction: jest.requireActual("../interview-ui").ConfirmAction,
  InterviewDocument: ({
    placeholder,
    onChange,
  }: {
    placeholder?: string;
    onChange?: (value: unknown) => void;
  }) => (
    <div data-editable={onChange ? "true" : "false"}>
      {placeholder ?? "document"}
    </div>
  ),
  InterviewError: ({ error }: { error?: unknown }) =>
    error ? <div role="alert">{error instanceof Error ? error.message : "error"}</div> : null,
  InterviewField: ({
    label,
    children,
  }: {
    label: string;
    children: ReactNode;
  }) => (
    <div>
      <div>{label}</div>
      {children}
    </div>
  ),
  InterviewPanel: ({
    title,
    action,
    children,
  }: {
    title?: string;
    action?: ReactNode;
    children: ReactNode;
  }) => (
    <section>
      {title ? <h2>{title}</h2> : null}
      {action}
      {children}
    </section>
  ),
  InterviewSelect: ({
    label,
    value,
    options,
    onChange,
  }: {
    label: string;
    value: string | null;
    options: { id: string; label: string; disabled?: boolean }[];
    onChange: (value: string | null) => void;
  }) => (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="">None</option>
      {options.map((option) => (
        <option key={option.id} value={option.id} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

jest.mock("@altitutor/ui", () => ({
  useToast: () => ({ toast: mockToast }),
  InterviewRoundOverview: jest.requireActual(
    "@altitutor/ui/components/interview-round-overview",
  ).InterviewRoundOverview,
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    asChild,
    variant,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
    variant?: string;
  }) =>
    asChild ? (
      <>{children}</>
    ) : (
      <button data-variant={variant} {...props}>
        {children}
      </button>
    ),
  Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Switch: ({
    checked,
    disabled,
    onCheckedChange,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
  InterviewMedia: ({
    registerFinalize,
  }: {
    registerFinalize?: (callback: (() => Promise<void>) | null) => void;
  }) => {
    React.useEffect(() => {
      registerFinalize?.(mockFinalizeAudio);
      return () => registerFinalize?.(null);
    }, [registerFinalize]);
    return <div>In-person audio</div>;
  },
  Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
  AlertDialog: ({
    open,
    children,
  }: {
    open?: boolean;
    children?: ReactNode;
  }) => (open ? <div role="alertdialog">{children}</div> : null),
  AlertDialogContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children?: ReactNode }) => (
    <h2>{children}</h2>
  ),
  AlertDialogDescription: ({ children }: { children?: ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogCancel: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  AlertDialogAction: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

function textDoc(text: string) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function roundFixture(delivery: InterviewRound["delivery"]): InterviewRound {
  const stations = Array.from({ length: 6 }, (_, index) => ({
    id: `station-${index + 1}`,
    stationId: `bank-${index + 1}`,
    name: `Station ${index + 1}`,
    prompt: textDoc("Read the scenario outside the room."),
    maximumPoints: 10,
    questions: [
      {
        id: `placement-${index + 1}`,
        questionId: `question-${index + 1}`,
        question: textDoc("What do you choose to do and why?"),
        rubric: textDoc("Marks the decision and the reason."),
        rubricVersion: 4,
        suggestedTimeSeconds: 90,
      },
    ],
  }));
  return {
    id: "round-1",
    version: 3,
    createdBy: "tutor-1",
    createdAt: "2026-10-23T00:00:00.000Z",
    updatedAt: "2026-10-23T00:00:00.000Z",
    interviewId: "interview-1",
    name: "Adelaide MMI",
    delivery,
    mode: "feedback",
    recordingEnabled: true,
    scheduledAt: null,
    studentIds: ["student-1"],
    assignments: [],
    startedAt: "2026-10-23T01:00:00.000Z",
    phase: "questions",
    rotation: 0,
    phaseStartedAt: "2026-10-23T01:05:00.000Z",
    phaseDeadline: "2099-10-23T01:15:00.000Z",
    pausedAt: null,
    remainingMilliseconds: null,
    readingTimeSeconds: 60,
    questionTimeSeconds: 480,
    stations,
    progress: stations.map((station, index) => ({
      stationId: station.id,
      tutorId: `tutor-${index + 1}`,
      studentId: index === 0 ? "student-1" : null,
      ready: index === 0,
      endedEarly: false,
      feedbackComplete: false,
    })),
    students: [{ id: "student-1", name: "Sam Student" }],
    tutors: stations.map((_, index) => ({
      id: `tutor-${index + 1}`,
      name: `Tutor ${index + 1}`,
    })),
    attempts: [
      {
        id: "attempt-1",
        studentId: "student-1",
        stationId: "station-1",
        version: 1,
        score: 3,
        notAssessedReason: null,
        generalFeedback: null,
        feedback: [],
        completed: false,
        updatedAt: "2026-10-23T01:06:00.000Z",
        updatedBy: "tutor-1",
      },
    ],
    releasedResults: [],
    recordings: [],
    connectedStudentIds: ["student-1"],
    sharedAction: { type: "startReading", actorId: "tutor-1" },
    phaseHistory: [
      { rotation: 0, phase: "waiting", milliseconds: 31_000 },
      { rotation: 0, phase: "reading", milliseconds: 120_000 },
    ],
    serverNow: "2026-10-23T01:06:00.000Z",
  };
}

beforeEach(() => {
  catalogueAvailable = true;
  mockMutateAsync.mockReset();
  mockRefetch.mockReset().mockImplementation(async () => ({ data: currentRound, isError: false }));
  mockFlush.mockReset().mockResolvedValue(undefined);
  mockFinalizeAudio.mockReset().mockResolvedValue(undefined);
  mockLeaveTo.mockClear();
  mockQuestionSelected.mockClear();
});

it("waits for feedback and final audio before opening completed results", async () => {
  let saved!: () => void;
  let finalized!: () => void;
  mockFlush.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        saved = resolve;
      }),
  );
  mockFinalizeAudio.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finalized = resolve;
      }),
  );
  currentRound = { ...roundFixture("in_person"), phase: "feedback" };
  const { rerender } = render(<InterviewWorkspace id="round-1" />);
  currentRound = { ...currentRound, phase: "completed" };
  rerender(<InterviewWorkspace id="round-1" />);
  expect(mockFlush).toHaveBeenCalled();
  expect(mockLeaveTo).not.toHaveBeenCalled();
  await act(async () => saved());
  expect(mockFinalizeAudio).toHaveBeenCalled();
  expect(mockLeaveTo).not.toHaveBeenCalled();
  await act(async () => finalized());
  expect(mockLeaveTo).toHaveBeenCalledWith(
    "/interviews/rounds/round-1/results",
  );
});

it("keeps the page and recovery draft when completion saving fails, then retries", async () => {
  mockFlush.mockRejectedValueOnce(new Error("Offline"));
  currentRound = { ...roundFixture("in_person"), phase: "feedback" };
  const { rerender } = render(<InterviewWorkspace id="round-1" />);
  currentRound = { ...currentRound, phase: "completed" };
  await act(async () => rerender(<InterviewWorkspace id="round-1" />));
  expect(mockLeaveTo).not.toHaveBeenCalled();
  expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  await act(async () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Save and view results" }),
    ),
  );
  expect(mockLeaveTo).toHaveBeenCalledWith(
    "/interviews/rounds/round-1/results",
  );
});

it("keeps completed results navigation blocked while audio upload fails", async () => {
  mockFinalizeAudio.mockRejectedValueOnce(new Error("Audio upload failed"));
  currentRound = { ...roundFixture("in_person"), phase: "feedback" };
  const { rerender } = render(<InterviewWorkspace id="round-1" />);
  currentRound = { ...currentRound, phase: "completed" };
  await act(async () => rerender(<InterviewWorkspace id="round-1" />));
  expect(mockLeaveTo).not.toHaveBeenCalled();
  await act(async () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Save and view results" }),
    ),
  );
  expect(mockLeaveTo).toHaveBeenCalledTimes(1);
});

describe("in-person interview round", () => {
  it("submits one transition when the same control is clicked while feedback is saving", async () => {
    let finishSaving!: () => void;
    const saving = new Promise<void>((resolve) => { finishSaving = resolve; });
    mockFlush.mockReturnValue(saving);
    currentRound = roundFixture("in_person");
    let serverVersion = currentRound.version;
    const receipts = new Set<string>();
    mockMutateAsync.mockReset().mockImplementation(async (command: {
      commandId: string;
      expectedVersion: number;
    }) => {
      if (receipts.has(command.commandId)) return;
      if (command.expectedVersion !== serverVersion)
        throw Object.assign(new Error("Round changed; reload before trying again"), { status: 409 });
      receipts.add(command.commandId);
      serverVersion++;
    });
    const { rerender } = render(<InterviewWorkspace id="round-1" />);

    const pause = screen.getByRole("button", { name: "Pause everyone" });
    fireEvent.click(pause);
    // Saving/query updates can render a fresh command identity before the RPC starts.
    rerender(<InterviewWorkspace id="round-1" />);
    fireEvent.click(pause);
    expect(mockMutateAsync).not.toHaveBeenCalled();

    await act(async () => finishSaving());

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ type: "pause", expectedVersion: 3 }),
    );
  });

  it("keeps controls pending through feedback saving and the command response", async () => {
    let finishSaving!: () => void;
    let finishCommand!: () => void;
    mockFlush.mockReturnValue(new Promise<void>((resolve) => { finishSaving = resolve; }));
    mockMutateAsync.mockReturnValue(new Promise<void>((resolve) => { finishCommand = resolve; }));
    currentRound = roundFixture("in_person");
    render(<InterviewWorkspace id="round-1" />);

    const pause = screen.getByRole("button", { name: "Pause everyone" });
    fireEvent.click(pause);
    expect(pause).toHaveAttribute("aria-disabled", "true");
    await act(async () => finishSaving());
    expect(pause).toHaveAttribute("aria-disabled", "true");
    await act(async () => finishCommand());
    expect(pause).toBeEnabled();
  });

  it("allows retry when feedback saving fails before a transition", async () => {
    mockFlush.mockRejectedValueOnce(new Error("Offline"));
    currentRound = roundFixture("in_person");
    render(<InterviewWorkspace id="round-1" />);

    const pause = screen.getByRole("button", { name: "Pause everyone" });
    await act(async () => fireEvent.click(pause));
    expect(screen.getByRole("alert")).toHaveTextContent("Offline");
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(pause).toBeEnabled();

    await act(async () => fireEvent.click(pause));
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the fixed toolbar, station row, and combined feedback card", async () => {
    currentRound = roundFixture("in_person");
    const { container } = render(<InterviewWorkspace id="round-1" />);

    expect(
      screen.getByRole("heading", { name: "Adelaide MMI" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /hide toolbar/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "6 staff" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "1 student" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("You are online")).toBeInTheDocument();
    expect(
      screen
        .getAllByText("Question time")
        .some((item) => item.className.includes("bg-blue-600")),
    ).toBe(true);
    expect(screen.getByText("Rotation 1/6")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toBeInTheDocument();
    expect(
      screen.getByText("Question phase remaining · 8:00 total"),
    ).toBeInTheDocument();
    expect(screen.getByText("Rotation 1")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("0:31")).toBeInTheDocument();
    expect(screen.getByText("Reading")).toBeInTheDocument();
    expect(screen.getByText("2:00")).toBeInTheDocument();
    expect(screen.getByText("Station 1 · Connected")).toBeInTheDocument();
    expect(
      screen.getByText("Station 2 · Question time · 0/1 · Offline"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/In person/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Station 1 · Station 1").length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText("Time remaining")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pause everyone" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exit" })).toHaveAttribute(
      "data-variant",
      "destructive",
    );

    const stations = container.querySelector('[aria-label="Stations"]');
    expect(stations?.className).toContain("overflow-x-auto");
    expect(stations?.className).toContain("p-1");
    expect(stations?.className).not.toContain("grid-cols");
    expect(
      screen.getAllByText("Question time · 0/1", { exact: true }),
    ).toHaveLength(6);
    expect(
      screen.getAllByText("Question time · 0/1", { exact: true })[0]?.className,
    ).toContain("bg-blue-600");

    expect(screen.getAllByText("Tutor").length).toBeGreaterThan(1);
    const stationList = within(screen.getByLabelText("Stations"));
    expect(stationList.getByRole("button", { name: "Tutor 1" })).toBeInTheDocument();
    expect(stationList.getByRole("button", { name: "Sam Student" })).toBeInTheDocument();
    expect(stationList.getByRole("button", { name: "End my station early" })).toBeInTheDocument();
    expect(stationList.getByLabelText("Student locked")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Here now").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Not yet").length).toBeGreaterThan(0);
    expect(screen.getByText("Reading started by Tutor 1")).toBeInTheDocument();
    expect(
      screen.getByText("Question feedback", { selector: "p" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Previous question" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Next question" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Select arriving student" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "End my station early" }),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText("All feedback saved")).toHaveLength(2);
    expect(
      screen.getByRole("heading", { name: "Station feedback" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Question feedback" }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByText("Write feedback to mark this question answered…")[0]
        ?.closest("[data-editable]"),
    ).toHaveAttribute("data-editable", "true");
    expect(screen.getByText("In-person audio")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Reading prompt" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "1. What do you choose to do and why?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("90s")).toBeInTheDocument();
    expect(screen.getByText("Recommended answer time")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rubric" })).toBeInTheDocument();
    expect(screen.queryByText(/Rubric · revision/)).not.toBeInTheDocument();
    expect(screen.queryByText("Unanswered")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Feedback" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Question 1, unanswered" }),
    ).toBeInTheDocument();
    expect(screen.getByText("General station feedback")).toBeInTheDocument();

    mockMutateAsync.mockClear();
    fireEvent.click(
      screen.getByRole("button", { name: "End my station early" }),
    );
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "You cannot go back to question time.",
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "End my station early" }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "End station" }));
    });
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ type: "endStation" }),
    );
  });

  it("requires confirmation before ending question time for every station", async () => {
    currentRound = roundFixture("in_person");
    mockMutateAsync.mockClear();
    render(<InterviewWorkspace id="round-1" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Skip question time for everyone" }),
    );
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Every station will move to feedback now.",
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockMutateAsync).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Skip question time for everyone" }),
    );
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Skip for everyone" }),
      );
    });
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "skipQuestions",
        roundId: "round-1",
        expectedVersion: 3,
      }),
    );
  });

  it("starts in-person reading before students arrive once every tutor is ready", async () => {
    const waiting = roundFixture("in_person");
    currentRound = {
      ...waiting,
      phase: "waiting",
      phaseDeadline: null,
      progress: waiting.progress.map((item) => ({
        ...item,
        studentId: null,
        ready: true,
      })),
    };
    mockMutateAsync.mockClear();
    await act(async () => { render(<InterviewWorkspace id="round-1" />); });
    expect(screen.queryByRole("button", { name: "Start reading" })).not.toBeInTheDocument();
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ type: "startReading" }),
    );
  });

  it("waits for the missing online student, then starts reading when they connect", async () => {
    const round = roundFixture("online");
    currentRound = {
      ...round,
      phase: "waiting",
      phaseDeadline: null,
      progress: round.progress.map((item) => ({ ...item, ready: true })),
      connectedStudentIds: [],
    };
    const { rerender } = render(<InterviewWorkspace id="round-1" />);
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Continue with missing students" })).toBeInTheDocument();
    currentRound = { ...currentRound, connectedStudentIds: ["student-1"] };
    await act(async () => { rerender(<InterviewWorkspace id="round-1" />); });
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ type: "startReading" }),
    );
  });

  it("retries automatic reading when a student reconnects at the same round version", async () => {
    const round = roundFixture("online");
    currentRound = {
      ...round,
      phase: "waiting",
      phaseDeadline: null,
      progress: round.progress.map((item) => ({ ...item, ready: true })),
      connectedStudentIds: ["student-1"],
    };
    mockMutateAsync.mockImplementationOnce(async () => {
      currentRound = { ...currentRound, connectedStudentIds: [] };
      throw new Error("The student disconnected.");
    });
    const view = render(<InterviewWorkspace id="round-1" />);
    await act(async () => {});
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    view.rerender(<InterviewWorkspace id="round-1" />);
    currentRound = { ...currentRound, connectedStudentIds: ["student-1"] };
    await act(async () => view.rerender(<InterviewWorkspace id="round-1" />));
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    expect(mockMutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "startReading", expectedVersion: round.version }),
    );
  });

  it("retries a presence rejection once if the student already reconnected before refresh", async () => {
    const round = roundFixture("online");
    currentRound = {
      ...round,
      phase: "waiting",
      phaseDeadline: null,
      progress: round.progress.map((item) => ({ ...item, ready: true })),
      connectedStudentIds: ["student-1"],
    };
    mockMutateAsync.mockRejectedValue(new Error("Students are disconnected; explicit override required"));
    await act(async () => { render(<InterviewWorkspace id="round-1" />); });
    await act(async () => {});
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
  });

  it("makes a paused round obvious and offers resume", () => {
    currentRound = {
      ...roundFixture("in_person"),
      pausedAt: "2026-10-23T01:07:00.000Z",
      pausedBy: "tutor-1",
      remainingMilliseconds: 125000,
    };
    const { container } = render(<InterviewWorkspace id="round-1" />);

    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText("by Tutor 1")).toBeInTheDocument();
    expect(
      screen.getByText("Timer frozen · Question phase remaining · 8:00 total"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resume everyone" }),
    ).toBeInTheDocument();
    expect(container.querySelector("header")?.className).toContain(
      "bg-amber-400",
    );
    expect(screen.getByRole("button", { name: "End my station early" })).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps feedback finishing disabled until a paused round resumes", () => {
    currentRound = {
      ...roundFixture("in_person"),
      phase: "feedback",
      pausedAt: "2026-10-23T01:07:00.000Z",
      pausedBy: "tutor-1",
    };
    const { rerender } = render(<InterviewWorkspace id="round-1" />);
    expect(screen.getByRole("button", { name: "Finish feedback" })).toHaveAttribute("aria-disabled", "true");

    currentRound = { ...currentRound, pausedAt: null, pausedBy: null };
    rerender(<InterviewWorkspace id="round-1" />);
    expect(screen.getByRole("button", { name: "Finish feedback" })).toBeEnabled();
  });

  it("uses the shared round screen with the video on the background online", () => {
    currentRound = roundFixture("online");
    render(<InterviewWorkspace id="round-1" />);

    expect(
      screen.queryByRole("button", { name: "Hide toolbar" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Unanswered")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Video" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("In-person audio")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Select arriving student"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exit" })).toHaveAttribute(
      "data-variant",
      "destructive",
    );
    expect(
      screen.getAllByText("Question time · 0/1", { exact: true }),
    ).toHaveLength(6);
    expect(screen.getAllByLabelText("All feedback saved")).toHaveLength(2);
  });

  it("allows an arriving student through readiness and reading, then locks question time", async () => {
    const waiting = roundFixture("in_person");
    currentRound = {
      ...waiting,
      phase: "waiting",
      phaseDeadline: null,
      students: [
        { id: "student-1", name: "Sam Student" },
        { id: "student-2", name: "Alex Student" },
        { id: "student-3", name: "Other Student" },
      ],
      studentIds: ["student-1", "student-2", "student-3"],
      progress: waiting.progress.map((item, index) => ({
        ...item,
        studentId: index === 1 ? "student-3" : null,
        ready: false,
      })),
      attempts: [
        {
          ...waiting.attempts[0],
          completed: true,
        },
        {
          ...waiting.attempts[0],
          id: "attempt-2",
          studentId: "student-2",
          completed: false,
        },
      ],
    };
    const view = render(<InterviewWorkspace id="round-1" />);

    expect(
      screen.getByRole("button", { name: "I’m ready" }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole("option", {
        name: "Sam Student · already did this station",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("option", { name: "Alex Student" }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole("option", { name: "Other Student" }),
    ).toBeDisabled();
    mockMutateAsync.mockClear();
    await act(async () => {
      fireEvent.change(
        screen.getByRole("combobox", { name: "Select arriving student" }),
        {
          target: { value: "student-2" },
        },
      );
    });
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "claimStudent",
        studentId: "student-2",
      }),
    );
    expect(
      screen.queryByRole("button", { name: "End my station early" }),
    ).not.toBeInTheDocument();

    currentRound = {
      ...currentRound,
      progress: currentRound.progress.map((item, index) =>
        index === 0 ? { ...item, studentId: "student-2" } : item,
      ),
    };
    view.rerender(<InterviewWorkspace id="round-1" />);
    expect(
      screen.getByRole("button", { name: "I’m ready" }),
    ).not.toBeDisabled();
    expect(
      screen
        .getAllByText("Write overall feedback for this station (optional)…")[0]
        ?.closest("[data-editable]"),
    ).toHaveAttribute("data-editable", "false");

    currentRound = {
      ...currentRound,
      progress: currentRound.progress.map((item, index) =>
        index === 0 ? { ...item, ready: true } : item,
      ),
    };
    view.rerender(<InterviewWorkspace id="round-1" />);
    expect(
      screen.getByRole("combobox", { name: "Select arriving student" }),
    ).toHaveValue("student-2");
    expect(
      screen.getByRole("button", { name: "Mark not ready" }),
    ).not.toBeDisabled();

    currentRound = {
      ...currentRound,
      phase: "reading",
      phaseDeadline: "2099-10-23T01:15:00.000Z",
    };
    view.rerender(<InterviewWorkspace id="round-1" />);
    expect(
      screen.getByRole("combobox", { name: "Select arriving student" }),
    ).toHaveValue("student-2");
    expect(
      screen.getByRole("option", { name: "Other Student" }),
    ).toBeDisabled();

    currentRound = { ...currentRound, pausedAt: "2026-10-23T01:07:00.000Z" };
    view.rerender(<InterviewWorkspace id="round-1" />);
    expect(
      screen.queryByRole("combobox", { name: "Select arriving student" }),
    ).not.toBeInTheDocument();

    currentRound = { ...currentRound, pausedAt: null, phase: "questions" };
    view.rerender(<InterviewWorkspace id="round-1" />);
    expect(
      screen.queryByRole("combobox", { name: "Select arriving student" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Alex Student" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Student locked").length).toBeGreaterThan(
      0,
    );
  });

  it("keeps an unstarted round in the waiting room until every tutor has joined", async () => {
    mockMutateAsync.mockClear();
    const waiting = roundFixture("in_person");
    currentRound = {
      ...waiting,
      startedAt: null,
      phase: "waiting",
      phaseDeadline: null,
      connectedTutorIds: [],
      connectedStudentIds: [],
    };
    const view = render(<InterviewWorkspace id="round-1" />);
    expect(screen.getByRole("button", { name: "Start round" })).toHaveAttribute("aria-disabled", "true");
    mockToast.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    expect(mockToast).toHaveBeenCalledWith({ description: "Wait until every tutor has joined." });
    expect(screen.getByText("Tutor 1 · You")).toBeInTheDocument();
    expect(screen.getAllByText("Not in portal").length).toBeGreaterThan(0);
    expect(screen.getByText("In portal")).toBeInTheDocument();
    expect(screen.getByText("In person")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Join links" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Tutor link")).toHaveValue(
      `${window.location.origin}/interviews/rounds/round-1/waiting`,
    );
    expect(screen.getByLabelText("Student link")).toHaveValue(
      "http://localhost:3001/interviews/rounds/round-1",
    );
    expect(
      screen.queryByRole("heading", { name: "Question feedback" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Full screen" }),
    ).toBeInTheDocument();
    expect(mockMutateAsync).not.toHaveBeenCalled();

    currentRound = {
      ...currentRound,
      connectedTutorIds: waiting.tutors.map((tutor) => tutor.id),
    };
    view.rerender(<InterviewWorkspace id="round-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("The setup is locked after this.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mockMutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: "Start round",
        }),
      );
    });
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ type: "start" }),
    );
  });
});

test("a tutor can resolve a missed encounter with a reason while retaining written feedback", async () => {
  mockMutateAsync.mockClear();
  mockMutateAsync.mockResolvedValue({ id: "missed", version: 2 });
  const base = roundFixture("in_person");
  currentRound = {
    ...base,
    phase: "waiting",
    phaseDeadline: null,
    students: [...base.students, { id: "student-2", name: "Absent Student" }],
    attempts: [
      ...base.attempts,
      {
        ...base.attempts[0],
        id: "missed",
        studentId: "student-2",
        score: null,
        generalFeedback: "Existing context",
        feedback: [],
      },
    ],
  };
  render(<InterviewWorkspace id="round-1" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Resolve missed stations" }),
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Student" }), {
    target: { value: "student-2" },
  });
  expect(
    screen.getByRole("button", { name: "Save not-assessed reason" }),
  ).toBeDisabled();
  fireEvent.change(
    screen.getByRole("textbox", { name: "Reason not assessed" }),
    { target: { value: "Student had to leave" } },
  );
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Save not-assessed reason" }),
    );
  });
  expect(mockMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "saveAttempt",
      attemptId: "missed",
      score: null,
      notAssessedReason: "Student had to leave",
      generalFeedback: "Existing context",
      feedback: [],
    }),
  );
});

test("resolved missed encounters permit explicit completion from waiting without claiming attendance", async () => {
  mockMutateAsync.mockClear();
  mockMutateAsync.mockResolvedValue({ id: "round-1", version: 4 });
  const base = roundFixture("in_person");
  currentRound = {
    ...base,
    phase: "waiting",
    phaseDeadline: null,
    progress: base.progress.map((item) => ({
      ...item,
      studentId: null,
      ready: false,
    })),
    attempts: [
      { ...base.attempts[0], completed: true },
      {
        ...base.attempts[0],
        id: "missed",
        stationId: "station-2",
        completed: false,
        score: null,
        notAssessedReason: "Student had to leave",
      },
    ],
  };
  render(<InterviewWorkspace id="round-1" />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Complete round" }));
  });
  expect(mockMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({ type: "next" }),
  );
  expect(
    mockMutateAsync.mock.calls.some(
      ([command]) => command.type === "claimStudent",
    ),
  ).toBe(false);
});

it("starts question time at Question 1 after browsing Question 2 while reading", () => {
  currentRound = { ...roundFixture("in_person"), phase: "reading" };
  const station = currentRound.stations[0];
  station.questions.push({
    ...station.questions[0],
    id: "placement-followup",
    questionId: "question-followup",
    question: textDoc("What is your next step?"),
  });
  const view = render(<InterviewWorkspace id="round-1" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Question 2, unanswered" }),
  );
  expect(
    screen.getByRole("button", { name: "Question 2, unanswered" }),
  ).toHaveAttribute("aria-current", "true");
  expect(mockQuestionSelected).not.toHaveBeenCalled();
  currentRound = {
    ...currentRound,
    phase: "questions",
    attempts: currentRound.attempts.map((attempt) => ({
      ...attempt,
      selectedQuestionId: station.questions[0].id,
    })),
  };
  view.rerender(<InterviewWorkspace id="round-1" />);
  expect(
    screen.getByRole("button", { name: "Question 1, unanswered" }),
  ).toHaveAttribute("aria-current", "true");
  expect(mockQuestionSelected).toHaveBeenCalledWith("placement-1");
  expect(mockQuestionSelected).not.toHaveBeenCalledWith("placement-followup");
});

it("preserves answering navigation through pause, resume, and rejoining an attempt", () => {
  currentRound = roundFixture("in_person");
  const station = currentRound.stations[0];
  station.questions.push({
    ...station.questions[0],
    id: "placement-followup",
    questionId: "question-followup",
    question: textDoc("What is your next step?"),
  });
  const view = render(<InterviewWorkspace id="round-1" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Question 2, unanswered" }),
  );
  expect(mockQuestionSelected).toHaveBeenLastCalledWith("placement-followup");
  mockQuestionSelected.mockClear();
  currentRound = { ...currentRound, pausedAt: "2026-10-23T01:06:30.000Z" };
  view.rerender(<InterviewWorkspace id="round-1" />);
  expect(
    screen.getByRole("button", { name: "Question 2, unanswered" }),
  ).toHaveAttribute("aria-current", "true");
  expect(mockQuestionSelected).not.toHaveBeenCalled();
  currentRound = {
    ...currentRound,
    pausedAt: null,
    phaseStartedAt: "2026-10-23T01:05:30.000Z",
  };
  view.rerender(<InterviewWorkspace id="round-1" />);
  expect(
    screen.getByRole("button", { name: "Question 2, unanswered" }),
  ).toHaveAttribute("aria-current", "true");
  expect(mockQuestionSelected).toHaveBeenLastCalledWith("placement-followup");
  view.unmount();
  mockQuestionSelected.mockClear();
  currentRound = {
    ...currentRound,
    attempts: currentRound.attempts.map((attempt) => ({
      ...attempt,
      selectedQuestionId: "placement-followup",
    })),
  };
  render(<InterviewWorkspace id="round-1" />);
  expect(
    screen.getByRole("button", { name: "Question 2, unanswered" }),
  ).toHaveAttribute("aria-current", "true");
  expect(mockQuestionSelected).toHaveBeenLastCalledWith("placement-followup");
  expect(mockQuestionSelected).not.toHaveBeenCalledWith("placement-1");
});


test("explains whose feedback blocks the next rotation and sends no command", async () => {
  currentRound = { ...roundFixture("in_person"), phase: "feedback" };
  mockMutateAsync.mockClear(); mockToast.mockClear();
  const { rerender } = render(<InterviewWorkspace id="round-1" />);
  const next = screen.getByRole("button", { name: "Next rotation" });
  expect(next).toHaveAttribute("aria-disabled", "true");
  await act(async () => fireEvent.click(next));
  expect(mockMutateAsync).not.toHaveBeenCalled();
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining("Tutor 1") }));
  currentRound = { ...currentRound, progress: currentRound.progress.map((item) => ({ ...item, feedbackComplete: true })) };
  rerender(<InterviewWorkspace id="round-1" />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Next rotation" })));
  expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ type: "next" }));
});

it("allows another tutor to become ready while submitting readiness", async () => {
  currentRound = {
    ...roundFixture("in_person"),
    phase: "waiting",
    phaseDeadline: null,
    progress: roundFixture("in_person").progress.map((item) => ({
      ...item,
      ready: false,
    })),
  };
  const initial = currentRound;
  render(<InterviewWorkspace id="round-1" />);
  currentRound = {
    ...initial,
    version: initial.version + 1,
    progress: initial.progress.map((item, index) =>
      index === 1 ? { ...item, ready: true } : item,
    ),
  };
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "I’m ready" })),
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(mockMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({ type: "ready", ready: true, expectedVersion: 4 }),
  );
});

it.each(["ready", "claimStudent"] as const)(
  "retries %s when another station commits after refresh",
  async (type) => {
    currentRound = {
      ...roundFixture("in_person"),
      phase: "waiting",
      phaseDeadline: null,
      students: [
        { id: "student-1", name: "Sam Student" },
        { id: "student-2", name: "Alex Student" },
      ],
      studentIds: ["student-1", "student-2"],
      attempts: [],
      progress: roundFixture("in_person").progress.map((item) => ({
        ...item,
        ready: false,
      })),
    };
    render(<InterviewWorkspace id="round-1" />);
    mockMutateAsync
      .mockImplementationOnce(async () => {
        currentRound = {
          ...currentRound,
          version: 4,
          progress: currentRound.progress.map((item, index) =>
            index === 1 ? { ...item, ready: true } : item,
          ),
        };
        throw Object.assign(
          new Error("Round changed; reload before trying again"),
          { status: 409 },
        );
      })
      .mockResolvedValue({});
    await act(async () => {
      if (type === "ready")
        fireEvent.click(screen.getByRole("button", { name: "I’m ready" }));
      else
        fireEvent.change(
          screen.getByRole("combobox", { name: "Select arriving student" }),
          { target: { value: "student-2" } },
        );
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    const first = mockMutateAsync.mock.calls[0][0];
    expect(mockMutateAsync.mock.calls[1][0]).toEqual({
      ...first,
      expectedVersion: 4,
    });
  },
);

function waitingSetupRound(): InterviewRound {
  const round = roundFixture("in_person");
  return {
    ...round,
    phase: "waiting",
    phaseDeadline: null,
    progress: round.progress.map((item) => ({ ...item, ready: false })),
  };
}

it("allows all five other stations to commit before readiness succeeds", async () => {
  currentRound = waitingSetupRound();
  render(<InterviewWorkspace id="round-1" />);
  let competingStation = 1;
  mockMutateAsync.mockImplementation(async () => {
    if (competingStation === 6) return {};
    const index = competingStation++;
    currentRound = {
      ...currentRound,
      version: currentRound.version + 1,
      progress: currentRound.progress.map((item, i) =>
        i === index ? { ...item, ready: true } : item,
      ),
    };
    throw Object.assign(
      new Error("Round changed; reload before trying again"),
      { status: 409 },
    );
  });
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "I’m ready" })),
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(mockMutateAsync).toHaveBeenCalledTimes(6);
  expect(
    new Set(mockMutateAsync.mock.calls.map(([command]) => command.commandId))
      .size,
  ).toBe(1);
  expect(mockMutateAsync.mock.calls[5][0].expectedVersion).toBe(8);
});

it.each([
  [
    "own readiness",
    (round: InterviewRound) => ({
      ...round,
      progress: round.progress.map((item, index) =>
        index === 0 ? { ...item, ready: true } : item,
      ),
    }),
  ],
  [
    "own student",
    (round: InterviewRound) => ({
      ...round,
      progress: round.progress.map((item, index) =>
        index === 0 ? { ...item, studentId: null } : item,
      ),
    }),
  ],
  [
    "phase",
    (round: InterviewRound) => ({ ...round, phase: "reading" as const }),
  ],
  ["rotation", (round: InterviewRound) => ({ ...round, rotation: 1 })],
  [
    "pause",
    (round: InterviewRound) => ({ ...round, pausedAt: "2026-10-23T01:00:01Z" }),
  ],
  [
    "deadline",
    (round: InterviewRound) => ({
      ...round,
      phaseDeadline: "2026-10-23T01:01:00Z",
    }),
  ],
] as const)("does not retry readiness after %s changes", async (_, change) => {
  currentRound = waitingSetupRound();
  render(<InterviewWorkspace id="round-1" />);
  mockMutateAsync.mockImplementationOnce(async () => {
    currentRound = change({ ...currentRound, version: 4 });
    throw Object.assign(
      new Error("Round changed; reload before trying again"),
      { status: 409 },
    );
  });
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "I’m ready" })),
  );
  expect(screen.getByRole("alert")).toHaveTextContent("The round changed");
  expect(mockMutateAsync).toHaveBeenCalledTimes(1);
});

it.each([
  Object.assign(new Error("Offline"), { status: undefined }),
  Object.assign(new Error("Gateway timeout"), { status: 504 }),
  Object.assign(new Error("Invalid student"), { status: 400 }),
])(
  "does not replay an uncertain or non-conflict command failure: %s",
  async (error) => {
    currentRound = waitingSetupRound();
    render(<InterviewWorkspace id="round-1" />);
    mockMutateAsync.mockRejectedValue(error);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "I’m ready" })),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(error.message);
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  },
);

it("limits repeated readiness conflicts and restores the control", async () => {
  currentRound = waitingSetupRound();
  render(<InterviewWorkspace id="round-1" />);
  mockMutateAsync.mockRejectedValue(
    Object.assign(new Error("Round changed; reload before trying again"), {
      status: 409,
    }),
  );
  const ready = screen.getByRole("button", { name: "I’m ready" });
  await act(async () => fireEvent.click(ready));
  expect(mockMutateAsync).toHaveBeenCalledTimes(11);
  expect(screen.getByRole("alert")).toHaveTextContent("Round changed");
  expect(ready).toBeEnabled();
});

it("does not submit using cached round data when refresh fails", async () => {
  currentRound = waitingSetupRound();
  mockRefetch.mockResolvedValue({ data: currentRound, isError: true });
  render(<InterviewWorkspace id="round-1" />);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "I’m ready" })),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Unable to refresh the round",
  );
  expect(mockMutateAsync).not.toHaveBeenCalled();
});

it("does not automatically replay a shared pause command", async () => {
  currentRound = roundFixture("in_person");
  mockMutateAsync.mockRejectedValue(
    Object.assign(new Error("Round changed; reload before trying again"), {
      status: 409,
    }),
  );
  render(<InterviewWorkspace id="round-1" />);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Pause everyone" })),
  );
  expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("alert")).toHaveTextContent("Round changed");
});

it("handles interleaved student selections and readiness from all five peers", async () => {
  currentRound = waitingSetupRound();
  render(<InterviewWorkspace id="round-1" />);
  let peerWrite = 0;
  mockMutateAsync.mockImplementation(async () => {
    if (peerWrite === 10) return {};
    const stationIndex = Math.floor(peerWrite / 2) + 1;
    const markingReady = peerWrite++ % 2 === 1;
    currentRound = {
      ...currentRound,
      version: currentRound.version + 1,
      progress: currentRound.progress.map((item, index) =>
        index === stationIndex
          ? { ...item, studentId: `student-${index + 1}`, ready: markingReady }
          : item,
      ),
    };
    throw Object.assign(new Error("Round changed; reload before trying again"), {
      status: 409,
    });
  });
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "I’m ready" })),
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(mockMutateAsync).toHaveBeenCalledTimes(11);
  expect(new Set(mockMutateAsync.mock.calls.map(([command]) => command.commandId)).size).toBe(1);
  expect(mockMutateAsync.mock.calls[10][0].expectedVersion).toBe(13);
});


it("keeps the assigned station and controls usable without loading the authoring catalogue", async () => {
  catalogueAvailable = false;
  currentRound = roundFixture("in_person");
  render(<InterviewWorkspace id="round-1" />);
  expect(screen.getByRole("button", { name: "Pause everyone" })).not.toHaveAttribute("aria-disabled", "true");
  expect(screen.getAllByText("Sam Student").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Pause everyone" }));
  await act(async () => { await Promise.resolve(); });
  expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ type: "pause", expectedVersion: 3 }));
});
