"use client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import {
  getMessageContactsForStudent,
  type ThreadMessage,
} from "@/features/messages/api/queries";
import type { Journey } from "../lib/model";

export function useJourneyConversations(journey: Journey) {
  return useQuery({
    queryKey: ["onboarding", journey.id, "conversations"],
    queryFn: async () => {
      const db = getSupabaseClient();
      const ids = new Set<string>(
        journey.contact_id ? [journey.contact_id] : [],
      );
      const studentIds = new Set<string>();
      if (journey.student_id) {
        for (const c of await getMessageContactsForStudent(
          journey.student_id,
        )) {
          ids.add(c.id);
          studentIds.add(c.id);
        }
        const parents = await db
          .from("parents_students")
          .select("parent_id")
          .eq("student_id", journey.student_id);
        if (parents.error) throw parents.error;
        if (parents.data.length) {
          const contacts = await db
            .from("contacts")
            .select("id")
            .in(
              "parent_id",
              parents.data.map((p) => p.parent_id),
            );
          if (contacts.error) throw contacts.error;
          contacts.data.forEach((c) => ids.add(c.id));
        }
      }
      if (!ids.size) return { contacts: [], conversations: [] };
      const contacts = await db
        .from("contacts")
        .select(
          "*, students(first_name,last_name), parents(first_name,last_name)",
        )
        .in("id", [...ids]);
      if (contacts.error) throw contacts.error;
      const groups = await db
        .from("group_chat_participants")
        .select("conversation_id")
        .in("contact_id", [...ids]);
      if (groups.error) throw groups.error;
      const filter = `contact_id.in.(${[...ids].join(",")})${groups.data.length ? `,id.in.(${groups.data.map((g) => g.conversation_id).join(",")})` : ""}`;
      const conversations = await db
        .from("conversations")
        .select("*, owned_numbers(*)")
        .or(filter);
      if (conversations.error) throw conversations.error;
      return {
        contacts: contacts.data.map((c) => ({
          ...c,
          kind: c.parent_id ? "parent" : "student",
          label:
            [
              c.students?.first_name ?? c.parents?.first_name,
              c.students?.last_name ?? c.parents?.last_name,
            ]
              .filter(Boolean)
              .join(" ") ||
            c.phone_e164 ||
            c.email ||
            "Enquiry contact",
        })),
        conversations: conversations.data,
      };
    },
  });
}
export function useJourneyMessages(
  conversations: NonNullable<
    ReturnType<typeof useJourneyConversations>["data"]
  >["conversations"],
) {
  const ids = conversations.map((c) => c.id).sort();
  return useInfiniteQuery({
    queryKey: ["onboarding", "messages", ids],
    enabled: ids.length > 0,
    initialPageParam: 0,
    refetchInterval: 15_000,
    queryFn: async ({
      pageParam,
    }): Promise<{ items: ThreadMessage[]; next?: number }> => {
      const { data, error } = await getSupabaseClient()
        .from("messages")
        .select(
          "*, staff:created_by_staff_id(id,first_name,last_name), message_attachments(id,storage_url,filename,mime_type,size_bytes)",
        )
        .in("conversation_id", ids)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(pageParam, pageParam + 99);
      if (error) throw error;
      return {
        items: data.map((m) => {
          const c = conversations.find((c) => c.id === m.conversation_id);
          return {
            ...m,
            sender: c?.owned_numbers ?? null,
            conversation_owned_number_id: c?.owned_number_id ?? null,
          };
        }),
        next: data.length === 100 ? pageParam + 100 : undefined,
      };
    },
    getNextPageParam: (p) => p.next,
  });
}

export function useJourneyEmails(journeyId: string) {
  return useInfiniteQuery({
    queryKey: ["onboarding", journeyId, "emails"],
    initialPageParam: 0,
    refetchInterval: 30_000,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await getSupabaseClient().rpc(
        "onboarding_emails_for_journey",
        { p_journey_id: journeyId, p_offset: pageParam, p_limit: 100 },
      );
      if (error) throw error;
      return {
        items: data,
        next: data.length === 100 ? pageParam + 100 : undefined,
      };
    },
    getNextPageParam: (p) => p.next,
  });
}
export function useMailboxStatus() {
  return useQuery({
    queryKey: ["onboarding", "mailbox-status"],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from("onboarding_mailbox_sync")
        .select("folder,synced_at,last_error");
      if (error) throw error;
      return data;
    },
  });
}
