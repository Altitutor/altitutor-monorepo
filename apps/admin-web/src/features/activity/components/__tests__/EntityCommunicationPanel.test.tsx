import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EntityCommunicationPanel } from "../EntityCommunicationPanel";

beforeEach(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

jest.mock("../../hooks/useEntityCommunication", () => ({
  useEntityCommunicationContext: () => ({
    data: {
      children: [
        { id: "alex", label: "Alex Child" },
        { id: "sam", label: "Sam Child" },
      ],
      contacts: [
        {
          id: "parent-contact",
          kind: "parent",
          label: "Pat Parent",
          phoneE164: "+61400000000",
          email: null,
          isCurrent: true,
        },
      ],
      conversations: [],
    },
    refetch: jest.fn(),
  }),
  useEntityCommunicationMessages: () => ({
    data: { pages: [] },
    refetch: jest.fn(),
  }),
}));
jest.mock("../../hooks/useChildrenActivity", () => ({
  useChildrenActivity: () => ({ feeds: [] }),
}));
jest.mock("../../hooks", () => {
  const activity = () => ({ data: { events: [] }, fetchNextPage: jest.fn() });
  return {
    useStudentActivity: activity,
    useParentActivity: activity,
    useStaffActivity: activity,
    useFormResponseDialog: () => ({}),
    useEntityActivityNoteComposer: () => ({
      content: "",
      onChange: jest.fn(),
      onSubmit: jest.fn(),
    }),
    activityKeys: {
      student: (id: string) => ["student", id],
      parent: (id: string) => ["parent", id],
      staff: (id: string) => ["staff", id],
    },
  };
});
jest.mock("@/features/messages/components/MessageThread", () => ({
  MessageThread: () => <div>Thread</div>,
}));
jest.mock("@/features/messages/components/Composer", () => ({
  Composer: ({
    toolbarBeforeTemplate,
  }: {
    toolbarBeforeTemplate?: React.ReactNode;
  }) => <div>Message composer{toolbarBeforeTemplate}</div>,
}));
jest.mock("@/shared/components/NoteComposerWithTemplate", () => ({
  NoteComposerWithTemplate: ({
    modeControl,
  }: {
    modeControl?: React.ReactNode;
  }) => <div>Note composer{modeControl}</div>,
}));
jest.mock("@/features/feedback/components/FormResponseDialog", () => ({
  FormResponseDialog: () => null,
}));
jest.mock("@/features/messages/state/messagingUiStore", () => ({
  getMessagingDraftKey: () => "draft",
  usePersistedConversationDraft: () => ({ draft: "" }),
}));

function renderPanel(defaultShowActivity = true) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <EntityCommunicationPanel
        entityType="parent"
        entityId="parent"
        initialContactId="parent-contact"
        defaultShowActivity={defaultShowActivity}
      />
    </QueryClientProvider>,
  );
}

it("shows the selector by default on Activity, and switches back to messages when activity is unticked", async () => {
  const user = userEvent.setup();
  renderPanel();
  await user.click(screen.getByRole("tab", { name: "Note" }));
  expect(screen.getByText("Note composer")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Filter" }));
  await user.click(screen.getByRole("menuitemcheckbox", { name: "Activity" }));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("tab", { name: "Note" })).not.toBeInTheDocument();
  expect(screen.getByText("Message composer")).toBeInTheDocument();
});

it("starts conversations with activity hidden, and exposes the selector when either child activity is selected", async () => {
  const user = userEvent.setup();
  renderPanel(false);
  expect(screen.queryByRole("tab", { name: "Note" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Filter" }));
  expect(
    screen.getByRole("menuitemcheckbox", { name: "Activity" }),
  ).not.toBeChecked();
  expect(
    screen.getByRole("menuitemcheckbox", { name: "Alex Child activity" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("menuitemcheckbox", { name: "Sam Child activity" }),
  ).toBeInTheDocument();
  await user.click(
    screen.getByRole("menuitemcheckbox", { name: "Alex Child activity" }),
  );
  await user.keyboard("{Escape}");
  expect(screen.getByRole("tab", { name: "Note" })).toBeInTheDocument();
});

it("places the filter in the conversation header without a second toolbar", async () => {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EntityCommunicationPanel
        entityType="parent"
        entityId="parent"
        initialContactId="parent-contact"
        defaultShowActivity={false}
        renderHeader={(filter) => (
          <header aria-label="Conversation header">
            {filter}
            <button>Actions</button>
          </header>
        )}
      />
    </QueryClientProvider>,
  );
  expect(
    screen.getByRole("button", { name: "Filter" }).closest("header"),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Sort" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Pat Parent/ }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Filter" }));
  await user.click(
    screen.getByRole("menuitemcheckbox", { name: "Alex Child activity" }),
  );
  await user.keyboard("{Escape}");
  expect(screen.getByRole("tab", { name: "Note" })).toBeInTheDocument();
});
