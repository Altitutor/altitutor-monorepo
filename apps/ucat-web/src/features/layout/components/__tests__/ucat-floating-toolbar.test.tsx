import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UcatFloatingToolbar } from "@/features/layout/components/ucat-floating-toolbar";
import { discardExamAttempt } from "@/features/exam-attempts/api/exam-attempts-api";

const push = jest.fn();
const flushBeforeExit = jest.fn();
const clearLocal = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

jest.mock("@/features/question-engine/context/ucat-lag-context", () => ({
  useUcatLag: () => ({ enabled: false, setEnabled: jest.fn() }),
}));

jest.mock(
  "@/features/exam-attempts/context/exam-attempt-exit-sync-context",
  () => ({
    useExamAttemptExitSync: () => ({ flushBeforeExit }),
  }),
);

jest.mock(
  "@/features/exam-attempts/context/active-exam-attempt-context",
  () => ({
    useActiveExamAttempt: () => ({
      active: { kind: "set", attemptId: "attempt-123" },
      clearLocal,
    }),
  }),
);

jest.mock("@/features/exam-attempts/api/exam-attempts-api", () => ({
  discardExamAttempt: jest.fn(),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    variant: _variant,
    ...props
  }: React.ComponentProps<"button"> & { variant?: string }) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock("@altitutor/ui", () => ({
  AlertDialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div>{children}</div> : null),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  FeedbackDialog: () => null,
  Switch: ({
    onCheckedChange: _onCheckedChange,
    ...props
  }: React.ComponentProps<"button"> & {
    onCheckedChange?: (checked: boolean) => void;
  }) => <button {...props} />,
}));

const mockDiscardExamAttempt = jest.mocked(discardExamAttempt);

function openExitDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  fireEvent.click(screen.getByRole("button", { name: "Go home" }));
}

describe("UcatFloatingToolbar attempt exit flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    flushBeforeExit.mockResolvedValue(true);
    mockDiscardExamAttempt.mockResolvedValue();
  });

  it("offers cancel, discard, and save actions when exiting", () => {
    render(<UcatFloatingToolbar />);

    openExitDialog();

    expect(
      screen.getByRole("heading", { name: "Exit this attempt?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Exit and discard attempt" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Exit and save progress" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.queryByRole("heading", { name: "Exit this attempt?" }),
    ).not.toBeInTheDocument();
  });

  it("returns from discard confirmation to the exit choices on cancel", () => {
    render(<UcatFloatingToolbar />);

    openExitDialog();
    fireEvent.click(
      screen.getByRole("button", { name: "Exit and discard attempt" }),
    );

    expect(
      screen.getByRole("heading", { name: "Discard this attempt?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/This cannot be undone/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByRole("heading", { name: "Exit this attempt?" }),
    ).toBeInTheDocument();
  });

  it("discards the active attempt only after the second confirmation", async () => {
    render(<UcatFloatingToolbar />);

    openExitDialog();
    fireEvent.click(
      screen.getByRole("button", { name: "Exit and discard attempt" }),
    );

    expect(mockDiscardExamAttempt).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Discard attempt" }));

    await waitFor(() =>
      expect(mockDiscardExamAttempt).toHaveBeenCalledWith({
        kind: "set",
        attemptId: "attempt-123",
      }),
    );
    expect(flushBeforeExit).not.toHaveBeenCalled();
    expect(clearLocal).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("flushes progress and exits without another confirmation", async () => {
    render(<UcatFloatingToolbar />);

    openExitDialog();
    fireEvent.click(
      screen.getByRole("button", { name: "Exit and save progress" }),
    );

    await waitFor(() => expect(flushBeforeExit).toHaveBeenCalled());
    expect(mockDiscardExamAttempt).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/");
  });
});
