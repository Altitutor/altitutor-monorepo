import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useInterviewLeaveGuard } from "../use-interview-leave-guard";

function Guard({ enabled = true }: { enabled?: boolean }) {
  const guard = useInterviewLeaveGuard(enabled);
  return (
    <>
      <a href="/interviews">Interviews</a>
      <button onClick={guard.requestExit}>Exit</button>
      {guard.open && (
        <div role="alertdialog">
          <button onClick={guard.cancelExit}>Stay</button>
        </div>
      )}
    </>
  );
}

describe("interview navigation warnings", () => {
  it("intercepts a portal link until the student chooses to leave", () => {
    render(<Guard />);
    fireEvent.click(screen.getByRole("link", { name: "Interviews" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stay" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
  it("restores browser Back and shows the confirmation", () => {
    const go = jest
      .spyOn(window.history, "go")
      .mockImplementation(() => undefined);
    render(<Guard />);
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(go).toHaveBeenCalledWith(1);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    go.mockRestore();
  });
  it("warns on close only while the round is ongoing and removes the listener afterwards", () => {
    const { rerender } = render(<Guard />);
    const during = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(during);
    expect(during.defaultPrevented).toBe(true);
    rerender(<Guard enabled={false} />);
    const after = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
});
