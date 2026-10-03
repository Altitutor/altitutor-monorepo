import { render, screen } from "@testing-library/react";
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
