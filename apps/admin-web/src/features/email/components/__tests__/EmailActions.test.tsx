import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EmailActions } from "../EmailActions";
import type { MailboxData } from "../../types";
import { AccessoryTabContext } from "@/shared/contexts/AccessoryTabContext";
beforeAll(() => {
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
  Element.prototype.scrollIntoView = jest.fn();
});

it("disables stale hover shortcuts when an accessory tab becomes inactive or collapsed", () => {
  const reply = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AccessoryTabContext.Provider
        value={{
          tab: {
            key: "hidden-mail",
            id: "thread",
            kind: "email",
            title: "Mail",
            query: "",
          },
          active: false,
          close: () => {},
          navigate: () => {},
          registerClose: () => {},
        }}
      >
        <EmailActions
          ids={["one"]}
          threadId="thread"
          read
          assignedStaffId={null}
          mailbox={mailbox}
          hovered
          onReply={reply}
        />
      </AccessoryTabContext.Provider>
    </QueryClientProvider>,
  );
  fireEvent.keyDown(document.body, { key: "r" });
  expect(reply).not.toHaveBeenCalled();
});
it("ignores a hidden primary pane even if its last hover flag is stale", () => {
  const reply = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <div hidden>
        <EmailActions
          ids={["one"]}
          threadId="thread"
          read
          assignedStaffId={null}
          mailbox={mailbox}
          hovered
          onReply={reply}
        />
      </div>
    </QueryClientProvider>,
  );
  fireEvent.keyDown(document.body, { key: "r" });
  expect(reply).not.toHaveBeenCalled();
});
it("retains keyboard ownership when menu focus returns to a row whose mouse-enter flag has cleared", () => {
  const reply = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <div data-email-shortcut-target>
        <EmailActions
          ids={["one"]}
          threadId="thread"
          read
          assignedStaffId={null}
          mailbox={mailbox}
          onReply={reply}
        />
      </div>
    </QueryClientProvider>,
  );
  screen.getByRole("button", { name: "Reply (R)" }).focus();
  fireEvent.keyDown(document.activeElement!, { key: "r" });
  expect(reply).toHaveBeenCalledTimes(1);
});
const mailbox: MailboxData = {
  threads: [],
  hasMore: false,
  folders: [{ id: "archive", name: "Archive", parent_id: null }],
  staff: [],
  currentStaffId: "admin",
  configured: false,
  mailboxAddress: "admin@example.test",
  mailboxEnvironment: "development",
  templates: [],
  signature: "",
  sync: [],
};
it("scopes reply/forward/move shortcuts to the hovered email and leaves text entry alone", () => {
  const reply = jest.fn(),
    forward = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <input aria-label="Typing here" />
      <EmailActions
        ids={["one"]}
        threadId="thread"
        read
        assignedStaffId={null}
        mailbox={mailbox}
        hovered
        onReply={reply}
        onForward={forward}
      />
    </QueryClientProvider>,
  );
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Typing here" }), {
    key: "r",
  });
  expect(reply).not.toHaveBeenCalled();
  fireEvent.keyDown(document.body, { key: "r" });
  fireEvent.keyDown(document.body, { key: "f" });
  expect(reply).toHaveBeenCalledTimes(1);
  expect(forward).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(document.body, { key: "m" });
  expect(
    screen.getByPlaceholderText("Search Microsoft folders…"),
  ).toBeInTheDocument();
  fireEvent.keyDown(screen.getByPlaceholderText("Search Microsoft folders…"), {
    key: "r",
  });
  expect(reply).toHaveBeenCalledTimes(1);
});
