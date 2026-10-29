import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Mail, Plus } from "lucide-react";
import {
  RecordActionsProvider,
  useRecordCommands,
  useRegisterPageActions,
  useRegisterRecordActions,
} from "@/features/command-palette/RecordActionsContext";
import { AccessoryTabContext } from "@/shared/contexts/AccessoryTabContext";
jest.mock("next/navigation", () => ({ usePathname: () => "/email" }));
const compose = jest.fn(),
  reply = jest.fn();
function PageActions() {
  useRegisterPageActions("/email", [
    { id: "compose", title: "Compose email", icon: Plus, action: compose },
  ]);
  return null;
}
function ThreadActions() {
  useRegisterRecordActions("email", "thread-one", "Class change", [
    { id: "reply", title: "Reply to email", icon: Mail, action: reply },
  ]);
  return null;
}
function Palette() {
  const [open, setOpen] = useState(false);
  const commands = useRecordCommands();
  return (
    <>
      <button onClick={() => setOpen(!open)}>Commands</button>
      {open &&
        commands.map((command) => (
          <button key={command.id} onClick={command.action}>
            {command.title}
          </button>
        ))}
    </>
  );
}
it("registers mailbox page commands and the active email tab in the existing global palette registry", () => {
  render(
    <RecordActionsProvider>
      <PageActions />
      <AccessoryTabContext.Provider
        value={{
          tab: {
            key: "mail-tab",
            kind: "email",
            id: "thread-one",
            title: "Class change",
            query: "",
          },
          active: true,
          close: () => {},
          navigate: () => {},
          registerClose: () => {},
        }}
      >
        <ThreadActions />
      </AccessoryTabContext.Provider>
      <Palette />
    </RecordActionsProvider>,
  );
  fireEvent.click(screen.getByText("Commands"));
  fireEvent.click(screen.getByText("Compose email"));
  fireEvent.click(screen.getByText("Reply to email"));
  expect(compose).toHaveBeenCalledTimes(1);
  expect(reply).toHaveBeenCalledTimes(1);
});
