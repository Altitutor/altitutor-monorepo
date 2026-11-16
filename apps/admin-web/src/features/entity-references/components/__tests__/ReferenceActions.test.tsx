import { useEffect, useState, useRef, type ComponentRef } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, RichTextEditor } from "@altitutor/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QuickActionsProvider } from "@/shared/contexts/QuickActionsContext";
import { RecordActionsProvider } from "@/features/command-palette/RecordActionsContext";
import { ActionsMenu } from "@/shared/components/ActionsMenu";
import { EntityReferencePreview } from "../EntityReferenceHovers";
import { ReferenceActions } from "../ReferenceActions";
import { RichTextTemplateRecordActions } from '@/features/rich-text-templates/components/RichTextTemplateMenuItems';

jest.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
}));

function Fixture() {
  const [destination, setDestination] = useState(false);
  const [logged, setLogged] = useState(false);
  useEffect(() => {
    const open = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type: string;
        id: string;
      };
      window.history.replaceState({}, "", `/sessions/${detail.id}`);
      setDestination(true);
    };
    window.addEventListener("mentionClick", open);
    return () => window.removeEventListener("mentionClick", open);
  }, []);
  return (
    <>
      <EntityReferencePreview type="session" id="requested-session" />
      {destination && (
        <ActionsMenu
          type="session"
          entityId="requested-session"
          hasTutorLog={false}
          onLogSession={() => setLogged(true)}
          onOpenInPage={() => undefined}
        />
      )}
      {logged && <p>The requested session log opened</p>}
    </>
  );
}

it("shows session actions below preview information and runs the requested record handler after navigation", async () => {
  window.history.replaceState({}, "", "/classes/current-class");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      title: "Maths session",
      fields: [{ label: "Time", value: "4 pm" }],
      logged: false,
      actionState: { sessionType: "CLASS" },
    }),
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  try {
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <QuickActionsProvider>
            <RecordActionsProvider>
              <Fixture />
            </RecordActionsProvider>
          </QuickActionsProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole("button", { name: "Open session" }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Log session" }));
    expect(
      await screen.findByText("The requested session log opened"),
    ).toBeVisible();
    expect(window.location.pathname).toBe("/sessions/requested-session");
    await userEvent.click(
      screen.getByRole("button", { name: "Record actions" }),
    );
    await waitFor(() => expect(screen.getByRole("menu")).toBeVisible());
    expect(
      screen.queryByRole("menuitem", { name: "Open session" }),
    ).not.toBeInTheDocument();
  } finally {
    globalThis.fetch = originalFetch;
    queryClient.clear();
  }
});

function TopicDestination({
  legacy,
  redirect,
}: {
  legacy: boolean;
  redirect: () => void;
}) {
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (legacy) redirect();
  }, [legacy, redirect]);
  return (
    <>
      <ActionsMenu
        type="topic"
        entityId="topic-id"
        onEdit={() => setEditing(true)}
      />
      {editing && <p>Editing canonical topic</p>}
    </>
  );
}

function TopicFixture() {
  const [destination, setDestination] = useState<"legacy" | "canonical" | null>(
    null,
  );
  useEffect(() => {
    const navigate = () => {
      window.history.replaceState({}, "", "/topics/topic-id");
      setDestination("legacy");
    };
    window.addEventListener("mentionClick", navigate);
    return () => window.removeEventListener("mentionClick", navigate);
  }, []);
  return (
    <>
      <ReferenceActions
        type="topic"
        id="topic-id"
        details={{ title: "Calculus", fields: [] }}
      />
      {destination && (
        <TopicDestination
          key={destination}
          legacy={destination === "legacy"}
          redirect={() => {
            window.history.replaceState(
              {},
              "",
              "/subjects/maths/topics/topic-id",
            );
            setDestination("canonical");
          }}
        />
      )}
    </>
  );
}

it("keeps a topic edit open after the legacy route redirects to its canonical subject route", async () => {
  window.history.replaceState({}, "", "/subjects/maths");
  render(
    <ToastProvider>
      <QuickActionsProvider>
        <RecordActionsProvider>
          <TopicFixture />
        </RecordActionsProvider>
      </QuickActionsProvider>
    </ToastProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Edit topic" }));
  expect(await screen.findByText("Editing canonical topic")).toBeVisible();
  expect(window.location.pathname).toBe("/subjects/maths/topics/topic-id");
});

it.each(["message", "email"] as const)(
  "shows correspondence actions for a %s reference",
  async (type) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(
      ["onboarding", "enquiry-source", type, "message-id"],
      null,
    );
    client.setQueryData(["messages", "active-admin-staff"], []);
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <QuickActionsProvider>
            <RecordActionsProvider>
              <ReferenceActions
                type={type}
                id="message-id"
                details={{
                  title: "Hello",
                  fields: [],
                  destination: {
                    kind: type === "email" ? "email" : "messages",
                    id: "thread-id",
                    title: "Hello",
                    query: "",
                  },
                }}
              />
            </RecordActionsProvider>
          </QuickActionsProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByRole("button", { name: "Add task" })).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: type === "email" ? "Reply to email" : "Mark as unread",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: type === "email" ? "Forward email" : "Mark as read",
      }),
    ).toBeVisible();
    if (type === 'email') for (const name of ['Mark as read', 'Move to folder', 'Assign email', 'Delete email']) expect(screen.getByRole('button', { name })).toBeVisible();
    client.clear();
  },
);

it('keeps a requested template insertion until the destination editor initializes', async () => {
  window.history.replaceState({}, '', '/documents/doc-id');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['rich-text-templates', 'list'], [{ id: 'template-id', name: 'Greeting', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Dear student' }] }] } }]);
  function DelayedEditor() {
    const [loaded, setLoaded] = useState(false);
    const editor = useRef<ComponentRef<typeof RichTextEditor>>(null);
    return <>
      <RichTextTemplateRecordActions type="document" id="doc-id" config={{ getEditor: () => editor.current?.getEditor() ?? null, getCurrentContent: () => null }} />
      <ReferenceActions type="note" id="doc-id" details={{ title: 'Document', fields: [] }} />
      <button onClick={() => setLoaded(true)}>Load destination editor</button>
      {loaded && <RichTextEditor ref={editor} content={{ type: 'doc', content: [{ type: 'paragraph' }] }} onChange={() => undefined} />}
    </>;
  }
  render(<QueryClientProvider client={client}><ToastProvider><QuickActionsProvider><RecordActionsProvider><DelayedEditor /></RecordActionsProvider></QuickActionsProvider></ToastProvider></QueryClientProvider>);
  await userEvent.click(screen.getByText('Insert template'));
  await userEvent.click(screen.getByRole('button', { name: 'Greeting' }));
  expect(screen.queryByText('Dear student')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Load destination editor' }));
  expect(await screen.findByText('Dear student')).toBeVisible();
  client.clear();
});
