import {
  useMutation,
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { z } from "zod";
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
  const snapshots: Array<[QueryKey, MailboxData]> = [];
  for (const [key, data] of client.getQueriesData<MailboxData>({
    queryKey: ["email", "mailbox"],
  })) {
    if (!data) continue;
    snapshots.push([key, data]);
    const params = key[2] as { folder?: string } | undefined;
    const destination =
      command.action === "move"
        ? (data.folders.find(
            (folder) =>
              folder.id === command.folderId ||
              folder.role === command.folderId,
          )?.id ?? command.folderId)
        : undefined;
    client.setQueryData<MailboxData>(key, {
      ...data,
      threads: data.threads.flatMap((row) => {
        if (command.action === "assign")
          return [
            {
              ...row,
              ...(row.id === command.threadId
                ? { assignedStaffId: command.staffId }
                : {}),
            },
          ];
        if (!row.messageIds.some((id) => command.ids.includes(id)))
          return [row];
        if (command.action === "read") return [{ ...row, read: command.read }];
        if (!params?.folder || params.folder === destination) return [row];
        const remaining = row.messageIds.filter(
          (id) => !command.ids.includes(id),
        );
        return remaining.length ? [{ ...row, messageIds: remaining }] : [];
      }),
    });
  }
  return {
    rollback: () => {
      if (!keys.every((id) => owned.get(id) === token)) return;
      for (const [key, before] of snapshots)
        client.setQueryData<MailboxData>(key, (current) => {
          if (!current) return before;
          const rows = [...current.threads];
          before.threads.forEach((row, index) => {
            const affected =
              command.action === "assign"
                ? row.id === command.threadId
                : row.messageIds.some((id) => command.ids.includes(id));
            if (!affected) return;
            const at = rows.findIndex((item) => item.id === row.id);
            if (at < 0) rows.splice(Math.min(index, rows.length), 0, row);
            else
              rows[at] =
                command.action === "read"
                  ? { ...rows[at]!, read: row.read }
                  : command.action === "assign"
                    ? { ...rows[at]!, assignedStaffId: row.assignedStaffId }
                    : { ...rows[at]!, messageIds: row.messageIds };
          });
          return { ...current, threads: rows };
        });
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
export function useMailbox(
  params: {
    folder?: string;
    search?: string;
    assignee?: string;
    offset?: number;
    sort?: string;
    direction?: string;
  } = {},
) {
  const query = new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, String(value)]],
    ),
  );
  return useQuery({
    queryKey: ["email", "mailbox", params],
    queryFn: async () => mailboxSchema.parse(await mailRequest(`?${query}`)),
    staleTime: 10_000,
    refetchInterval: 15_000,
    // A new folder needs fresh rows, while its mailbox chrome remains stable.
    placeholderData: (previous) =>
      previous ? { ...previous, threads: [], hasMore: false } : undefined,
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
    for (let offset = 0; offset < command.ids.length; offset += 25)
      result = await mailRequest("/commands", {
        ...command,
        ids: command.ids.slice(offset, offset + 25),
      });
    return result;
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
      if (command.action === "assign")
        void client.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
export function useSyncMailbox() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => mailRequest("/sync", {}),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["email", "mailbox"] });
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
