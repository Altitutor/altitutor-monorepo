import React, { useEffect } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  ExamAttemptExitSyncProvider,
  useExamAttemptExitSync,
} from "@/features/exam-attempts/context/exam-attempt-exit-sync-context";

function RegisterFlush({ flush }: { flush: () => Promise<boolean> }) {
  const { registerExitFlush } = useExamAttemptExitSync();
  useEffect(() => registerExitFlush(flush), [flush, registerExitFlush]);
  return null;
}

function ExitButton() {
  const { flushBeforeExit } = useExamAttemptExitSync();
  return (
    <button type="button" onClick={() => void flushBeforeExit()}>
      Exit
    </button>
  );
}

describe("ExamAttemptExitSyncProvider", () => {
  it("runs the registered durable save before an exit", async () => {
    const flush = jest.fn().mockResolvedValue(true);
    render(
      <ExamAttemptExitSyncProvider>
        <RegisterFlush flush={flush} />
        <ExitButton />
      </ExamAttemptExitSyncProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Exit" }));

    await waitFor(() => expect(flush).toHaveBeenCalledTimes(1));
  });
});
