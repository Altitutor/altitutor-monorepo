import {
  useMutation,
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { z } from "zod";
import { emailCommandFeedback } from "./feedback";
import {
  mailboxSchema,
  emailThreadSchema,
  emailMessageSchema,
  type EmailCommand,
  type MailboxData,
} from "../types";
type OptimisticCommand = Extract<
  EmailCommand,
  { action: "move" | "read" | "assign" }
>;
const revisions = new WeakMap<QueryClient, Map<string, symbol>>();
function optimisticMailbox(client: QueryClient, command: OptimisticCommand) {
  const token = Symbol();
  const owned = revisions.get(client) ?? new Map<string, symbol>();
  revisions.set(client, owned);
  const keys = command.action === "assign" ? [command.threadId] : command.ids;
  keys.forEach((id) => owned.set(id, token));
  type MailboxCache = MailboxData | InfiniteData<MailboxData, number>;
  const mapPages = (data: MailboxCache, map: (page: MailboxData, index: number) => MailboxData): MailboxCache =>
    "pages" in data ? { ...data, pages: data.pages.map(map) } : map(data, 0);
  const snapshots: Array<[QueryKey, MailboxCache]> = [];
  for (const [key, data] of client.getQueriesData<MailboxCache>({
    queryKey: ["email", "mailbox"],
  })) {
    if (!data) continue;
    snapshots.push([key, data]);
    const params = key[2] as { folder?: string } | undefined;
    client.setQueryData<MailboxCache>(key, mapPages(data, (page) => {
      const destination = command.action === "move"
        ? page.folders.find((folder) => folder.id === command.folderId || folder.role === command.folderId)?.id ?? command.folderId
        : undefined;
      return {
        ...page,
        threads: page.threads.flatMap((row) => {
          if (command.action === "assign")
            return [row.id === command.threadId ? { ...row, assignedStaffId: command.staffId } : row];
          if (!row.messageIds.some((id) => command.ids.includes(id))) return [row];
          if (command.action === "read") return [{ ...row, read: command.read }];
          if (!params?.folder || params.folder === destination) return [row];
          const remaining = row.messageIds.filter((id) => !command.ids.includes(id));
          return remaining.length ? [{ ...row, messageIds: remaining }] : [];
        }),
      };
    }));
  }
  return {
    rollback: () => {
      if (!keys.every((id) => owned.get(id) === token)) return;
      for (const [key, before] of snapshots) {
        const previousPages = "pages" in before ? before.pages : [before];
        client.setQueryData<MailboxCache>(key, (current) => {
          if (!current) return before;
          const affected = (row: MailboxData["threads"][number]) => command.action === "assign"
            ? row.id === command.threadId
            : row.messageIds.some((id) => command.ids.includes(id));
          const beforeById = new Map(previousPages.flatMap((page) =>
            page.threads.filter(affected).map((row) => [row.id, row] as const),
          ));
          const currentPages = "pages" in current ? current.pages : [current];
          const present = new Set(currentPages.flatMap((page) => page.threads.map((row) => row.id)));
          return mapPages(current, (page, pageIndex) => {
            const rows = page.threads.map((row) => {
              const previous = beforeById.get(row.id);
              if (!previous) return row;
              if (command.action === "read") return { ...row, read: previous.read };
              if (command.action === "assign") return { ...row, assignedStaffId: previous.assignedStaffId };
              return { ...row, messageIds: previous.messageIds };
            });
            if (command.action === "move") {
              previousPages[pageIndex]?.threads.forEach((row, index) => {
                if (!beforeById.has(row.id) || present.has(row.id)) return;
                present.add(row.id);
                rows.splice(Math.min(index, rows.length), 0, row);
              });
            }
            return { ...page, threads: rows };
          });
        });
      }
    },
    finish: () =>
      keys.forEach((id) => {
        if (owned.get(id) === token) owned.delete(id);
      }),
  };
}
export async function mailRequest(
  path: string,
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(`/api/email${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(value);
    throw new Error(
      error.success ? error.data.error : "The mailbox request failed.",
    );
  }
  return value;
}
const unreadMailCountKey = ["email", "unread-count"] as const;
const unreadMailCountSchema = z.object({ count: z.number().int().nonnegative() });

export function useUnreadMailCount() {
  return useQuery({
    queryKey: unreadMailCountKey,
    queryFn: async () => unreadMailCountSchema.parse(await mailRequest("/unread-count")).count,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

type MailboxParams = {
  folder?: string;
  search?: string;
  assignee?: string;
  from?: string;
  offset?: number;
  sort?: string;
  direction?: string;
};
const mailboxPageSize = 50;
async function fetchMailbox(params: MailboxParams) {
  const query = new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, String(value)]],
    ),
  );
  return mailboxSchema.parse(await mailRequest(`?${query}`));
}
export function useMailbox(params: MailboxParams = {}, enabled = true) {
  return useQuery({
    queryKey: ["email", "mailbox", params],
    enabled,
    queryFn: () => fetchMailbox(params),
    staleTime: 10_000,
    refetchInterval: 15_000,
    placeholderData: (previous) =>
      previous ? { ...previous, threads: [], hasMore: false } : undefined,
  });
}
export function useMailboxList(params: Omit<MailboxParams, "offset">, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["email", "mailbox", params, "infinite"],
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchMailbox({ ...params, offset: pageParam }),
    getNextPageParam: (page, _pages, offset) => page.hasMore ? offset + mailboxPageSize : undefined,
    placeholderData: (previous) => {
      const first = previous?.pages[0];
      return first ? { pages: [{ ...first, threads: [], hasMore: false }], pageParams: [0] } : undefined;
    },
    staleTime: 10_000,
    refetchInterval: (query) => (query.state.data?.pages.length ?? 0) <= 1 ? 15_000 : false,
  });
}
export function useEmailThread(id: string, active = true) {
  return useQuery({
    queryKey: ["email", "thread", id],
    queryFn: async () =>
      emailThreadSchema
        .extend({
          sends: z
            .array(
              z.object({
                message_id: z.string(),
                command_id: z.string(),
                scheduled_at: z.string().nullable(),
                state: z.string(),
                updated_at: z.string(),
              }),
            )
            .default([]),
        })
        .parse(await mailRequest(`/thread?id=${encodeURIComponent(id)}`)),
    enabled: Boolean(id),
    refetchInterval: active ? 15_000 : false,
    staleTime: 10_000,
  });
}
/** Long conversations progress through bounded idempotent read/move requests. */
export async function executeEmailCommand(
  command: EmailCommand,
): Promise<unknown> {
  if (
    (command.action === "read" || command.action === "move") &&
    command.ids.length > 25
  ) {
    let result: unknown;
    const undoIds: string[] = [];
    for (let offset = 0; offset < command.ids.length; offset += 25) {
      try {
        result = await mailRequest("/commands", {
          ...command,
          ids: command.ids.slice(offset, offset + 25),
        });
      } catch (error) {
        if (!undoIds.length) throw error;
        return {
          state: "partial",
          undoIds,
          error:
            "Some emails could not be changed. Undo restores the confirmed earlier changes; refresh to review the remaining emails.",
        };
      }
      const receipt = z
        .object({
          undoIds: z.array(z.string()).default([]),
          state: z.string().optional(),
        })
        .parse(result);
      undoIds.push(...receipt.undoIds);
      if (receipt.state === "partial") break;
    }
    return { ...(result && typeof result === "object" ? result : {}), undoIds };
  }
  return mailRequest("/commands", command);
}
export function useEmailCommand() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ["email", "command"],
    mutationFn: executeEmailCommand,
    onMutate: async (command) => {
      if (!["read", "move", "assign"].includes(command.action)) return;
      await client.cancelQueries({ queryKey: ["email", "mailbox"] });
      return optimisticMailbox(client, command as OptimisticCommand);
    },
    onError: (_error, _command, optimistic) => optimistic?.rollback(),
    onSuccess: (result, command) =>
      emailCommandFeedback(command, result, executeEmailCommand, () => {
        void client.invalidateQueries({ queryKey: ["email"] });
        void client.invalidateQueries({ queryKey: ["notifications"] });
      }),
    onSettled: (_data, _error, command, optimistic) => {
      optimistic?.finish();
      // Draft saves belong to the mounted editor. Refetching every active
      // mailbox/thread here makes each keystroke wait on unrelated reads.
      // Polling still reconciles changes made through Outlook.
      if (
        command.action === "save" ||
        command.action === "draft" ||
        command.action === "releaseDraft"
      )
        return;
      void client.invalidateQueries({ queryKey: ["email", "mailbox"] });
      void client.invalidateQueries({ queryKey: ["email", "thread"] });
      void client.invalidateQueries({ queryKey: ["email", "correspondence"] });
      if (command.action === "read" || command.action === "move" || command.action === "undo")
        void client.invalidateQueries({ queryKey: unreadMailCountKey });
      if (command.action === "assign")
        void client.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
export function useSyncMailbox() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (_background: boolean) => mailRequest("/sync", {}),
    onSettled: (result, _error, background) => {
      const changes = z.object({ imported: z.number(), removed: z.number().optional() }).safeParse(result);
      const changed = changes.success && changes.data.imported + (changes.data.removed ?? 0) > 0;
      void client.invalidateQueries({ queryKey: unreadMailCountKey });
      void client.invalidateQueries({
        queryKey: ["email", "mailbox"],
        predicate: (query) => {
          if (!background || changed) return true;
          const data = query.state.data as InfiniteData<MailboxData, number> | undefined;
          return query.queryKey[3] !== "infinite" || (data?.pages.length ?? 0) <= 1;
        },
      });
      void client.invalidateQueries({ queryKey: ["email", "thread"] });
      void client.invalidateQueries({ queryKey: ["email", "correspondence"] });
    },
  });
}
export function useEntityEmails(
  type: "student" | "parent" | "staff",
  id: string,
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: ["email", "correspondence", type, id],
    initialPageParam: 0,
    enabled: enabled && Boolean(id),
    queryFn: async ({ pageParam }) =>
      z
        .object({
          items: z.array(emailMessageSchema),
          next: z.number().nullable(),
        })
        .parse(
          await mailRequest(
            `/correspondence?type=${type}&id=${encodeURIComponent(id)}&offset=${pageParam}`,
          ),
        ),
    getNextPageParam: (page) => page.next ?? undefined,
    staleTime: 15_000,
  });
}
