/** @jest-environment jsdom */
import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  DialogScope,
  DialogScopeProvider,
  DialogScopePane,
} from "@altitutor/ui";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@altitutor/ui";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "@altitutor/ui";

function Workspace({ confirmation = false }: { confirmation?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [clicks, setClicks] = React.useState(0);
  return (
    <>
      <DialogScope>
        <button onClick={() => setOpen(true)}>Open form</button>
        {confirmation ? (
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogContent>
              <AlertDialogTitle>Confirm change</AlertDialogTitle>
              <AlertDialogDescription>
                Confirm this action.
              </AlertDialogDescription>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogTitle>Edit student</DialogTitle>
              <DialogDescription>Student details</DialogDescription>
              <input aria-label="Name" />
            </DialogContent>
          </Dialog>
        )}
      </DialogScope>
      <button onClick={() => setClicks((value) => value + 1)}>
        Sidebar {clicks}
      </button>
    </>
  );
}

it("keeps closed dialogs from making the pane inert", () => {
  render(<Workspace />);
  expect(screen.getByText("Open form").closest("[inert]")).toBeNull();
});

it("portals locally, blocks the main pane, and keeps sidebar focus and clicks without dismissing", async () => {
  const { container } = render(<Workspace />);
  fireEvent.click(screen.getByText("Open form"));
  const dialog = await screen.findByRole("dialog");
  expect(dialog.closest("[data-dialog-scope-portal]")).not.toBeNull();
  await waitFor(() =>
    expect(screen.getByText("Open form").closest("[inert]")).not.toBeNull(),
  );
  expect(document.body.style.pointerEvents).not.toBe("none");
  const sidebar = screen.getByText("Sidebar 0");
  expect(sidebar.closest('[aria-hidden="true"]')).toBeNull();
  fireEvent.pointerDown(sidebar);
  sidebar.focus();
  fireEvent.click(sidebar);
  expect(screen.getByText("Sidebar 1")).toBeTruthy();
  expect(document.activeElement).toBe(sidebar);
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(container.querySelector("[inert]")).toBeNull();
});

it("scopes confirmations, focuses cancel and does not dismiss on the backdrop", async () => {
  const { container } = render(<Workspace confirmation />);
  fireEvent.click(screen.getByText("Open form"));
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog.closest("[data-dialog-scope-portal]")).not.toBeNull();
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByText("Cancel")),
  );
  fireEvent.click(container.querySelector('[data-slot="dialog-overlay"]')!);
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  const sidebar = screen.getByText("Sidebar 0");
  fireEvent.pointerDown(sidebar);
  sidebar.focus();
  fireEvent.click(sidebar);
  expect(screen.getByText("Sidebar 1")).toBeTruthy();
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  fireEvent.click(screen.getByText("Cancel"));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
});

it("keeps dialogs modal outside a scope", async () => {
  render(
    <Dialog open>
      <DialogContent>
        <DialogTitle>Global dialog</DialogTitle>
        <DialogDescription>Details</DialogDescription>
      </DialogContent>
    </Dialog>,
  );
  await screen.findByRole("dialog");
  expect(document.body.style.pointerEvents).toBe("none");
});

it("also scopes dialogs launched from the accessory pane to the main pane", async () => {
  render(
    <DialogScopeProvider>
      <DialogScopePane>
        <button>Main content</button>
      </DialogScopePane>
      <aside>
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Sidebar form</DialogTitle>
            <DialogDescription>Details</DialogDescription>
          </DialogContent>
        </Dialog>
      </aside>
    </DialogScopeProvider>,
  );
  const dialog = await screen.findByRole("dialog");
  expect(dialog.closest("[data-dialog-scope-portal]")).not.toBeNull();
  expect(dialog.closest("aside")).toBeNull();
  await waitFor(() =>
    expect(screen.getByText("Main content").closest("[inert]")).not.toBeNull(),
  );
  expect(document.querySelector("aside")?.closest("[inert]")).toBeNull();
});
