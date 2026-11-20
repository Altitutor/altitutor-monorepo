"use client";

import { useEffect, useRef } from "react";
import {
  type QueryClient,
  type Query,
  type QueryFilters,
  type InfiniteData,
  useQueryClient,
} from "@tanstack/react-query";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import { useToast } from "@altitutor/ui";
import { messagesKeys } from "../api/queryKeys";
import type { Tables } from "@altitutor/shared";
import { useChatStore } from "../state/chatStore";
import { formatContactName } from "../utils/formatContactName";

type Message = Tables<"messages">;
type MessageChange = { new: Partial<Message> };
type Notify = ReturnType<typeof useToast>["toast"];
const subscriptions = new WeakMap<
  QueryClient,
  { release: () => void; count: number }
>();

/** One connection per query cache. Coalesce delivery bursts without invalidating
 * templates, class data, addresses or other unrelated messaging resources. */
export function useMessageSubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  useEffect(() => {
    const existing = subscriptions.get(queryClient);
    if (existing) {
      existing.count++;
      return () => {
        if (--existing.count === 0) {
          existing.release();
          subscriptions.delete(queryClient);
        }
      };
    }
    const subscription = startSubscription(queryClient, (options) =>
      toastRef.current(options),
    );
    subscriptions.set(queryClient, subscription);
    return () => {
      if (--subscription.count === 0) {
        subscription.release();
        subscriptions.delete(queryClient);
      }
    };
  }, [queryClient]);
}

function startSubscription(queryClient: QueryClient, notify: Notify) {
  const supabase = getSupabaseClient();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const changed = new Set<string>();
  const changedMessages = new Set<string>();
  const inserted = new Map<string, Message>();
  let readChanged = false;
  const schedule = () => {
    if (!timer)
      timer = setTimeout(() => {
        timer = undefined;
        void flush();
      }, 250);
  };
  const refreshQueries = (filters: QueryFilters) => {
    const alreadyFetching = new Set(
      queryClient
        .getQueryCache()
        .findAll(filters)
        .filter((query) => query.state.fetchStatus === "fetching")
        .map((query) => query.queryHash),
    );
    void queryClient
      .invalidateQueries(filters, { cancelRefetch: false })
      .then(() => {
        // An older request can finish with a pre-event snapshot. Refresh once
        // after settling, rather than cancel/restart on every delivery event.
        if (!stopped && alreadyFetching.size)
          return queryClient.invalidateQueries(
            { predicate: (query) => alreadyFetching.has(query.queryHash) },
            { cancelRefetch: false },
          );
      });
  };
  const flush = async () => {
    const conversationIds = [...changed];
    const messageIds = [...changedMessages];
    changedMessages.clear();
    const incoming = [...inserted.values()];
    const refreshReads = readChanged;
    changed.clear();
    inserted.clear();
    readChanged = false;
    // A single refetch per affected query per burst. No cancel/restart storm.
    if (conversationIds.length || refreshReads) {
      const predicate = (query: Query) => {
        const [root, family, id] = query.queryKey;
        if (root === "bulk-message-delivery" && Array.isArray(family))
          return family.some((messageId) =>
            messageIds.includes(String(messageId)),
          );
        if (root === "entity-communication" && family === "messages")
          return true;
        if (root !== messagesKeys.all[0]) return false;
        if (family === "messages") return conversationIds.includes(String(id));
        if (family === "messages-for-contact") {
          const cached = query.state.data as
            | InfiniteData<{ items: Pick<Message, "conversation_id">[] }>
            | undefined;
          return cached
            ? cached.pages.some((page) =>
                page.items.some((message) =>
                  conversationIds.includes(message.conversation_id ?? ""),
                ),
              )
            : conversationIds.length > 0;
        }
        return [
          "conversations",
          "conversations-by-contact",
          "unread-count",
          "sms-resends",
        ].includes(String(family));
      };
      refreshQueries({ predicate });
    }
    if (!incoming.length || stopped) return;
    // Resolve the entire INSERT burst at once, rather than one join per message.
    const { data, error } = await supabase
      .from("conversations")
      .select(
        `
      id, contact_id, is_group_chat, group_chat_name,
      contacts(id, phone_e164, email, contact_type,
        students(id, first_name, last_name),
        parents(id, first_name, last_name, parents_students(students(id, first_name, last_name))),
        staff(id, first_name, last_name, role))
    `,
      )
      .in("id", [
        ...new Set(
          incoming
            .map((row) => row.conversation_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ]);
    if (stopped) return;
    if (error) {
      console.error(
        "[useMessageSubscription] Failed to load message contexts",
        error,
      );
      // Enrichment must not suppress unread state or the incoming notification.
    }
    const contexts = new Map((data ?? []).map((row) => [row.id, row]));
    const inbound = incoming.filter(
      (row) => row.direction === "INBOUND" && !row.is_historical_import,
    );
    const unreadConversations = [
      ...new Set(
        inbound
          .map((row) => row.conversation_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (unreadConversations.length) {
      const { error: unreadError } = await supabase
        .from("conversation_reads")
        .delete()
        .in("conversation_id", unreadConversations);
      if (unreadError)
        console.error(
          "[useMessageSubscription] Failed to mark conversations unread",
          unreadError,
        );
    }
    const contacts = new Set<string>();
    const inboundContacts = new Set<string>();
    for (const row of incoming) {
      const context = contexts.get(row.conversation_id ?? "");
      if (context?.contact_id) {
        contacts.add(context.contact_id);
        if (row.direction === "INBOUND")
          inboundContacts.add(context.contact_id);
      }
    }
    // Empty contact threads have no cached conversation IDs yet.
    for (const contactId of contacts)
      refreshQueries({
        queryKey: messagesKeys.messagesForContactBase(contactId),
      });
    for (const contactId of inboundContacts)
      void queryClient.invalidateQueries(
        { queryKey: [...messagesKeys.all, "addresses", contactId] },
        { cancelRefetch: false },
      );
    if (stopped) return;
    for (const row of inbound) {
      const context = contexts.get(row.conversation_id ?? "");
      const sender = context?.contacts
        ? formatContactName({ contacts: context.contacts })
        : context?.group_chat_name || "Unknown";
      const store = useChatStore.getState();
      if (row.conversation_id && store.hasWindow(row.conversation_id))
        store.incrementUnread(row.conversation_id);
      notify({
        title: row.body?.trim()
          ? `${sender}: ${row.body}`
          : `${sender}: New message`,
        action: {
          label: "Reply",
          onClick: () => {
            if (context?.is_group_chat || !context?.contact_id) {
              window.location.assign(
                new URL(
                  `/messages?group=${row.conversation_id}`,
                  window.location.origin,
                ),
              );
            } else if (row.conversation_id) {
              useChatStore.getState().openWindow({
                conversationId: row.conversation_id,
                title: sender,
              });
            }
          },
        },
      });
    }
  };
  const onMessage = (payload: MessageChange, isInsert: boolean) => {
    const row = payload.new;
    if (!row.conversation_id) return;
    changed.add(row.conversation_id);
    if (row.id) changedMessages.add(row.id);
    if (isInsert && row.id) inserted.set(row.id, row as Message);
    schedule();
  };
  const channel = supabase
    .channel("admin-messages")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => onMessage(payload, true),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages" },
      (payload) => onMessage(payload, false),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversation_reads" },
      () => {
        readChanged = true;
        schedule();
      },
    )
    .subscribe();
  return {
    count: 1,
    release: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    },
  };
}
