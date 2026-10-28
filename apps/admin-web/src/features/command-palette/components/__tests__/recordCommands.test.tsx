import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CommandPalette } from "../CommandPalette";
import { CommandPaletteProvider } from "@/shared/contexts/CommandPaletteContext";
import { ActionsMenu } from "@/shared/components/ActionsMenu";
import { ToastProvider } from "@altitutor/ui";

jest.mock("next/navigation", () => ({
  usePathname: () => "/subjects/math/topics/functions",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn() }),
}));
// Search API is an agreed public boundary. This test exercises real menu registration and UI.
jest.mock("../../api/search", () => ({
  searchPaletteEntities: async () => ({ results: [], hasMore: false }),
}));

it("shares the current nested-topic menu actions with named palette targets", async () => {
  const edit = jest.fn();
  function Screen() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <ActionsMenu
          type="topic"
          entityId="functions"
          copyTagDisplayText="Functions and Graphs"
          onEdit={edit}
          onDelete={() => {}}
        />
        <button onClick={() => setOpen(true)}>Search records</button>
        <CommandPalette
          isOpen={open}
          onClose={() => setOpen(false)}
          onCreateDocument={() => {}}
        />
      </>
    );
  }
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <CommandPaletteProvider>
          <Screen />
        </CommandPaletteProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Search records" }));
  await user.type(screen.getByRole("searchbox"), "Edit Functions");
  const command = await screen.findByRole("option", {
    name: "Commands Edit topic Functions and Graphs",
  });
  expect(
    within(command)
      .getByText("Functions and Graphs")
      .closest("[data-entity-type]"),
  ).toHaveAttribute("data-entity-type", "topic");
  await user.click(command);
  expect(edit).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
});
