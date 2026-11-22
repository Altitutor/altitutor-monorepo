import { useChatStore } from "../../state/chatStore";
import { act, render, screen, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useMessageSubscription } from "../useMessageSubscription";
import { messagesKeys } from "../../api/queryKeys";

type Change = {
  new: {
    id?: string;
    conversation_id?: string;
    status?: string;
    direction?: string;
    body?: string;
    is_historical_import?: boolean;
  };
  old?: { id: string };
};
const inserts: Array<(event: Change) => void> = [];
const clearReads = jest.fn();
const contextLookup = jest.fn(async () => ({
  data: [] as { id: string; contact_id: string }[],
  error: { message: "Context lookup failed" } as { message: string } | null,
}));
const updates: Array<(event: Change) => void> = [];
const conversations: Array<(event: Change) => void> = [];
const removeChannel = jest.fn();
const toast = jest.fn();
jest.mock("@altitutor/ui", () => ({ useToast: () => ({ toast }) }));
jest.mock("@/shared/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    from: (table: string) => ({
      select: () => ({
        in: () => contextLookup(),
      }),
      delete: () => ({
        in: async (column: string, ids: string[]) => {
          clearReads(table, column, ids);
          return { error: null };
        },
      }),
    }),
    channel: () => {
      const channel = {
        on: (
          _type: string,
          filter: { event: string; table: string },
          callback: (event: Change) => void,
        ) => {
          if (filter.table === "messages" && filter.event === "UPDATE")
            updates.push(callback);
          if (filter.table === "messages" && filter.event === "INSERT")
            inserts.push(callback);
          if (filter.table === "conversations") conversations.push(callback);
          return channel;
        },
        subscribe: () => channel,
      };
      return channel;
    },
    removeChannel: (...args: unknown[]) => removeChannel(...args),
  }),
}));

function Subscription() {
  useMessageSubscription();
  return null;
}

test("conversation changes refresh inbox lists and unread state once per burst without reloading composer resources", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let current = "Unassigned";
  const requests = {
    list: jest.fn(async () => current),
    legacyList: jest.fn(async () => current),
    unread: jest.fn(async () => current),
    classes: jest.fn(async () => "Biology"),
    addresses: jest.fn(async () => "Ready"),
    activity: jest.fn(async () => "History"),
    resends: jest.fn(async () => "Resends"),
  };
  function Inbox() {
    const list = useQuery({ queryKey: messagesKeys.conversationsByContact("sender"), queryFn: requests.list, staleTime: Infinity });
    useQuery({ queryKey: messagesKeys.conversations(), queryFn: requests.legacyList, staleTime: Infinity });
    const unread = useQuery({ queryKey: messagesKeys.unreadCount(), queryFn: requests.unread, staleTime: Infinity });
    useQuery({ queryKey: messagesKeys.studentClasses("student"), queryFn: requests.classes, staleTime: Infinity });
    useQuery({ queryKey: [...messagesKeys.all, "addresses", "contact"], queryFn: requests.addresses, staleTime: Infinity });
    useQuery({ queryKey: ["entity-communication", "messages", "contact"], queryFn: requests.activity, staleTime: Infinity });
    useQuery({ queryKey: [...messagesKeys.all, "sms-resends", "contact"], queryFn: requests.resends, staleTime: Infinity });
    return <p>{list.data} / {unread.data}</p>;
  }
  conversations.length = 0;
  const view = render(<QueryClientProvider client={client}><Subscription /><Subscription /><Inbox /></QueryClientProvider>);
  await screen.findByText("Unassigned / Unassigned");
  current = "Assigned";
  act(() => {
    for (let index = 0; index < 50; index++)
      for (const changed of conversations) changed({ new: { id: "conversation", status: "OPEN" } });
  });
  await screen.findByText("Assigned / Assigned");
  expect(requests.list).toHaveBeenCalledTimes(2);
  expect(requests.legacyList).toHaveBeenCalledTimes(2);
  expect(requests.unread).toHaveBeenCalledTimes(2);
  expect(requests.classes).toHaveBeenCalledTimes(1);
  expect(requests.addresses).toHaveBeenCalledTimes(1);
  expect(requests.activity).toHaveBeenCalledTimes(1);
  expect(requests.resends).toHaveBeenCalledTimes(1);
  current = "Removed";
  act(() => {
    for (const changed of conversations) changed({ new: {}, old: { id: "conversation" } });
  });
  await screen.findByText("Removed / Removed");
  expect(requests.list).toHaveBeenCalledTimes(3);
  expect(requests.unread).toHaveBeenCalledTimes(3);
  view.unmount();
  client.clear();
});

test("an inbox keeps its shared updates until the last subscriber leaves, then discards pending refreshes", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let current = "Initial";
  const read = jest.fn(async () => current);
  function Inbox() {
    const list = useQuery({ queryKey: messagesKeys.conversations(), queryFn: read, staleTime: Infinity });
    return <p>{list.data}</p>;
  }
  function View({ count }: { count: number }) {
    return <QueryClientProvider client={client}>
      {count > 0 && <Subscription key="one" />}
      {count > 1 && <Subscription key="two" />}
      <Inbox />
    </QueryClientProvider>;
  }
  conversations.length = 0;
  removeChannel.mockClear();
  const view = render(<View count={2} />);
  await screen.findByText("Initial");
  view.rerender(<View count={1} />);
  current = "Updated";
  act(() => {
    for (const changed of conversations) changed({ new: { id: "conversation", status: "OPEN" } });
  });
  await screen.findByText("Updated");
  expect(read).toHaveBeenCalledTimes(2);
  expect(removeChannel).not.toHaveBeenCalled();
  current = "Queued after departure";
  act(() => {
    for (const changed of conversations) changed({ new: { id: "conversation", status: "CLOSED" } });
  });
  view.rerender(<View count={0} />);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
  expect(screen.getByText("Updated")).toBeInTheDocument();
  expect(read).toHaveBeenCalledTimes(2);
  expect(removeChannel).toHaveBeenCalledTimes(1);
  view.unmount();
  client.clear();
});

test("delivery updates for another conversation do not reload open preview classes or unrelated composer addresses", async () => {
  // Network boundary stand-ins for mounted preview/composer queries. The real
  // subscription and query cache decide whether these requests execute.
  const requests = {
    classes: jest.fn(async () => "Biology"),
    addresses: jest.fn(async () => "Ready"),
  };
  function OpenMessagingUi() {
    const classes = useQuery({
      queryKey: messagesKeys.studentClasses("student-a"),
      queryFn: requests.classes,
      staleTime: Infinity,
    });
    const addresses = useQuery({
      queryKey: [...messagesKeys.all, "addresses", "contact-a"],
      queryFn: requests.addresses,
      staleTime: Infinity,
    });
    return (
      <p>
        {classes.data} {addresses.data}
      </p>
    );
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  updates.length = 0;
  const view = render(
    <QueryClientProvider client={client}>
      <Subscription />
      <Subscription />
      <OpenMessagingUi />
    </QueryClientProvider>,
  );
  await screen.findByText("Biology Ready");
  expect(requests.classes).toHaveBeenCalledTimes(1);
  expect(requests.addresses).toHaveBeenCalledTimes(1);
  await act(async () => {
    for (let index = 0; index < 50; index++) {
      for (const update of updates)
        update({
          new: {
            id: `message-${index}`,
            conversation_id: "other-conversation",
            status: "SENT",
          },
        });
      await Promise.resolve();
    }
  });
  await waitFor(() => expect(client.isFetching()).toBe(0));
  expect(screen.getByText("Biology Ready")).toBeInTheDocument();
  expect(requests.classes).toHaveBeenCalledTimes(1);
  expect(requests.addresses).toHaveBeenCalledTimes(1);
  view.unmount();
  client.clear();
});

test("a delivery burst refreshes the affected live thread and unread count once while another thread stays cached", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const reads = {
    affected: jest.fn(async () => "Updated"),
    other: jest.fn(async () => "Unchanged"),
    unread: jest.fn(async () => "Unread"),
    otherContact: jest.fn(async () => ({
      pages: [{ items: [{ conversation_id: "other" }] }],
      pageParams: [null],
    })),
  };
  function Threads() {
    useQuery({
      queryKey: messagesKeys.messagesForContact("contact-other"),
      queryFn: reads.otherContact,
      staleTime: Infinity,
    });
    const affected = useQuery({
      queryKey: messagesKeys.messages("affected"),
      queryFn: reads.affected,
      staleTime: Infinity,
    });
    const other = useQuery({
      queryKey: messagesKeys.messages("other"),
      queryFn: reads.other,
      staleTime: Infinity,
    });
    const unread = useQuery({
      queryKey: messagesKeys.unreadCount(),
      queryFn: reads.unread,
      staleTime: Infinity,
    });
    return (
      <p>
        {affected.data} {other.data} {unread.data}
      </p>
    );
  }
  updates.length = 0;
  const view = render(
    <QueryClientProvider client={client}>
      <Subscription />
      <Subscription />
      <Threads />
    </QueryClientProvider>,
  );
  await screen.findByText("Updated Unchanged Unread");
  expect(updates).toHaveLength(1);
  await act(async () => {
    for (let index = 0; index < 50; index++)
      for (const update of updates)
        update({
          new: {
            id: `message-${index}`,
            conversation_id: "affected",
            status: "SENT",
          },
        });
  });
  await waitFor(() => expect(reads.affected).toHaveBeenCalledTimes(2));
  expect(reads.unread).toHaveBeenCalledTimes(2);
  expect(reads.other).toHaveBeenCalledTimes(1);
  expect(reads.otherContact).toHaveBeenCalledTimes(1);
  view.unmount();
  client.clear();
});

test("an update arriving during an older thread fetch is refreshed after that fetch settles", async () => {
  let finishFirst!: (value: string) => void;
  const first = new Promise<string>((resolve) => {
    finishFirst = resolve;
  });
  const read = jest
    .fn()
    .mockReturnValueOnce(first)
    .mockResolvedValue("New delivery status");
  function Thread() {
    const query = useQuery({
      queryKey: messagesKeys.messages("affected"),
      queryFn: read,
      staleTime: Infinity,
    });
    return <p>{query.data ?? "Loading thread"}</p>;
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  updates.length = 0;
  const view = render(
    <QueryClientProvider client={client}>
      <Subscription />
      <Thread />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  act(() =>
    updates[0]({
      new: { id: "message", conversation_id: "affected", status: "SENT" },
    }),
  );
  // Let the bounded coalescing window expire while the old request is in flight.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  await act(async () => {
    finishFirst("Old delivery status");
  });
  await screen.findByText("New delivery status");
  expect(read).toHaveBeenCalledTimes(2);
  view.unmount();
  client.clear();
});

test("an inbound message still updates unread state and notifies if context enrichment fails", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  useChatStore.getState().updateConversationTitle("inbound", "Inbound");
  function Inbox() {
    const count = useChatStore(
      (state) => state.conversations.get("inbound")?.unreadCount ?? 0,
    );
    return <p>Unread: {count}</p>;
  }
  inserts.length = 0;
  toast.mockClear();
  clearReads.mockClear();
  const view = render(
    <QueryClientProvider client={client}>
      <Subscription />
      <Inbox />
    </QueryClientProvider>,
  );
  act(() =>
    inserts[0]({
      new: {
        id: "inbound-message",
        conversation_id: "inbound",
        status: "DELIVERED",
        direction: "INBOUND",
        body: "Hello",
        is_historical_import: false,
      },
    }),
  );
  await screen.findByText("Unread: 1");
  expect(clearReads).toHaveBeenCalledWith(
    "conversation_reads",
    "conversation_id",
    ["inbound"],
  );
  expect(toast).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Unknown: Hello" }),
  );
  view.unmount();
  client.clear();
  useChatStore.getState().closeWindow("inbound");
});

test("an insert into a new conversation refreshes a contact thread after an older aggregate fetch settles", async () => {
  type Page = {
    pages: { items: { conversation_id: string; body: string }[] }[];
    pageParams: null[];
  };
  let finishFirst!: (value: Page) => void;
  const first = new Promise<Page>((resolve) => {
    finishFirst = resolve;
  });
  const queryKey = messagesKeys.messagesForContact("contact-new");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(queryKey, { pages: [{ items: [] }], pageParams: [null] });
  const read = jest
    .fn()
    .mockReturnValueOnce(first)
    .mockResolvedValue({
      pages: [
        {
          items: [{ conversation_id: "new-conversation", body: "New message" }],
        },
      ],
      pageParams: [null],
    });
  function Thread() {
    const { data } = useQuery<Page>({ queryKey, queryFn: read });
    return (
      <p>
        {data?.pages
          .flatMap((page) => page.items)
          .map((message) => message.body)
          .join(" ") || "Empty thread"}
      </p>
    );
  }
  inserts.length = 0;
  contextLookup.mockResolvedValueOnce({
    data: [{ id: "new-conversation", contact_id: "contact-new" }],
    error: null,
  });
  const view = render(
    <QueryClientProvider client={client}>
      <Subscription />
      <Thread />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  act(() =>
    inserts[0]({
      new: {
        id: "new-message",
        conversation_id: "new-conversation",
        status: "QUEUED",
        direction: "OUTBOUND",
      },
    }),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  await act(async () => {
    finishFirst({ pages: [{ items: [] }], pageParams: [null] });
  });
  await screen.findByText("New message");
  expect(read).toHaveBeenCalledTimes(2);
  view.unmount();
  client.clear();
});
