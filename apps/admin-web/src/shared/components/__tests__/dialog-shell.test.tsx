import { fireEvent, render, screen } from "@testing-library/react";
import { MediaQueryWidthProvider, useMediaQuery } from "@altitutor/ui";
import { AdminDialogShell } from "../dialog-shell";
function BreakpointProbe({ label }: { label: string }) {
  const desktop = useMediaQuery("(min-width: 768px)");
  return <output data-testid={label}>{desktop ? "columns" : "stack"}</output>;
}
test("portalled dialogs use the viewport breakpoint even when their launching pane is narrow", () => {
  const media = jest
    .spyOn(window, "matchMedia")
    .mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  render(
    <MediaQueryWidthProvider width={400}>
      <BreakpointProbe label="pane" />
      <AdminDialogShell open onClose={jest.fn()} title="Create record">
        <BreakpointProbe label="dialog" />
      </AdminDialogShell>
    </MediaQueryWidthProvider>,
  );
  expect(screen.getByTestId("pane")).toHaveTextContent("stack");
  expect(screen.getByTestId("dialog")).toHaveTextContent("columns");
  media.mockRestore();
});


test("disables closing while an operation is pending and restores it afterward", () => {
  const onClose = jest.fn();
  const { rerender } = render(<AdminDialogShell open closeDisabled onClose={onClose} title="Saving changes" subtitle="Applying changes">Processing</AdminDialogShell>);
  const closeButton = screen.getAllByRole("button", { name: "Close" }).find(button => button.hasAttribute("disabled"))!;
  expect(closeButton).toBeDisabled();
  fireEvent.click(closeButton);
  expect(onClose).not.toHaveBeenCalled();
  rerender(<AdminDialogShell open onClose={onClose} title="Saving changes" subtitle="Applying changes">Complete</AdminDialogShell>);
  expect(closeButton).toBeEnabled();
  fireEvent.click(closeButton);
  expect(onClose).toHaveBeenCalledTimes(1);
});
