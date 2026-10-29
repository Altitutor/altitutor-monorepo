import {
  useMutation,
  useQuery,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import {
  mailboxSchema,
  emailThreadSchema,
  emailMessageSchema,
  type EmailCommand,
} from "../types";
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
export function useEmailCommand() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (command: EmailCommand) => mailRequest("/commands", command),
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["email"] }),
        client.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
    },
  });
}
export function useSyncMailbox() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => mailRequest("/sync", {}),
    onSettled: () => client.invalidateQueries({ queryKey: ["email"] }),
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
