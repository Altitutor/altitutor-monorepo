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
    id: string;
    conversation_id: string;
    status: string;
    direction?: string;
    body?: string;
    is_historical_import?: boolean;
  };
};
const inserts: Array<(event: Change) => void> = [];
const clearReads = jest.fn();
const updates: Array<(event: Change) => void> = [];
const toast = jest.fn();
jest.mock("@altitutor/ui", () => ({ useToast: () => ({ toast }) }));
jest.mock("@/shared/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    from: (table: string) => ({
      select: () => ({
        in: async () => ({
          data: [],
          error: { message: "Context lookup failed" },
        }),
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
          return channel;
        },
        subscribe: () => channel,
      };
      return channel;
    },
    removeChannel: jest.fn(),
  }),
}));

function Subscription() {
  useMessageSubscription();
  return null;
}

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
