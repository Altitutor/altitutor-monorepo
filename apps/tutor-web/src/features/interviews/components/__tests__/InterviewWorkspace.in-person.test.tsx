import React, {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { InterviewRound } from "@altitutor/shared";
import { InterviewWorkspace } from "../InterviewWorkspace";

let currentRound: InterviewRound;
const mockMutateAsync = jest.fn();
const mockFlush = jest.fn();
const mockFinalizeAudio = jest.fn();
const mockLeaveTo = jest.fn();

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
    error: null,
    isError: false,
    isPending: false,
    refetch: jest.fn(async () => ({ data: currentRound })),
    heartbeatFailed: false,
  }),
  useInterviewCatalog: () => ({ data: { actorId: "tutor-1" } }),
  useInterviewCommand: () => ({
    isPending: false,
    error: null,
    mutateAsync: mockMutateAsync,
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
    error ? <div role="alert">error</div> : null,
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
  mockFlush.mockReset().mockResolvedValue(undefined);
  mockFinalizeAudio.mockReset().mockResolvedValue(undefined);
  mockLeaveTo.mockClear();
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
    expect(
      screen.getAllByRole("button", { name: "Tutor 1" }).length,
    ).toBeGreaterThan(1);
    expect(
      screen.getAllByRole("button", { name: "Sam Student" }).length,
    ).toBeGreaterThan(1);
    expect(screen.getAllByLabelText("Student locked").length).toBeGreaterThan(
      1,
    );
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

  it("holds the arriving student until the station is ready, then locks them", () => {
    const waiting = roundFixture("in_person");
    currentRound = {
      ...waiting,
      phase: "waiting",
      phaseDeadline: null,
      students: [
        { id: "student-1", name: "Sam Student" },
        { id: "student-2", name: "Alex Student" },
      ],
      studentIds: ["student-1", "student-2"],
      progress: waiting.progress.map((item) => ({
        ...item,
        studentId: null,
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
      screen.getByRole("button", { name: "Ready — idle this rotation" }),
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
      screen.queryByRole("combobox", { name: "Select arriving student" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Alex Student" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Student locked").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByRole("button", { name: "Mark not ready" }),
    ).not.toBeDisabled();
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
    expect(screen.getByRole("button", { name: "Start round" })).toBeDisabled();
    expect(
      screen.getByText("Wait until every tutor has joined."),
    ).toBeInTheDocument();
    expect(screen.getByText("Tutor 1 · You")).toBeInTheDocument();
    expect(screen.getAllByText("Not joined").length).toBeGreaterThan(0);
    expect(screen.getByText("Joined")).toBeInTheDocument();
    expect(screen.getByText("In person")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Join links" })).toBeInTheDocument();
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
