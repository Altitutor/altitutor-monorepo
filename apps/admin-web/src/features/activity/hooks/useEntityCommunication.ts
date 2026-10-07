"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import {
  getMessageContactsForStudent,
  type ThreadMessage,
} from "@/features/messages/api/queries";
import type {
  CommunicationContactKind,
  CommunicationEntityType,
} from "../lib/entityCommunication";

export interface EntityCommunicationContact {
  id: string;
  kind: CommunicationContactKind;
  label: string;
  phoneE164: string | null;
  email: string | null;
  isCurrent: boolean;
}

export interface EntityCommunicationConversation {
  id: string;
  contact_id: string | null;
  is_group_chat: boolean;
  group_chat_id: string | null;
  group_chat_name: string | null;
  owned_number_id: string;
  owned_numbers: ThreadMessage["sender"];
}

interface PersonName {
  first_name: string | null;
  last_name: string | null;
}

interface RawContact {
  id: string;
  phone_e164: string | null;
  email: string | null;
  student_id: string | null;
  parent_id: string | null;
  staff_id: string | null;
  students: PersonName | PersonName[] | null;
  parents: PersonName | PersonName[] | null;
  staff: PersonName | PersonName[] | null;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function personLabel(person: PersonName | null, fallback: string): string {
  const name = [person?.first_name, person?.last_name]
    .filter(Boolean)
    .join(" ");
  return name || fallback;
}

function contactKind(row: RawContact): CommunicationContactKind {
  if (row.parent_id) return "parent";
  if (row.staff_id) return "staff";
  return "student";
}

export function useEntityCommunicationContext(
  entityType: CommunicationEntityType,
  entityId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ["entity-communication", entityType, entityId, "context"],
    enabled: enabled && Boolean(entityId),
    queryFn: async (): Promise<{
      children: Array<{ id: string; label: string }>;
      contacts: EntityCommunicationContact[];
      conversations: EntityCommunicationConversation[];
    }> => {
      const db = getSupabaseClient();
      const children: Array<{ id: string; label: string }> = [];
      const ids = new Set<string>();
      const currentById = new Map<string, boolean>();

      if (entityType === "student") {
        for (const contact of await getMessageContactsForStudent(entityId)) {
          ids.add(contact.id);
          currentById.set(contact.id, contact.is_current);
        }
        const parents = await db
          .from("parents_students")
          .select("parent_id")
          .eq("student_id", entityId);
        if (parents.error) throw parents.error;
        const parentIds = parents.data.map((row) => row.parent_id);
        if (parentIds.length > 0) {
          const parentContacts = await db
            .from("contacts")
            .select("id")
            .in("parent_id", parentIds);
          if (parentContacts.error) throw parentContacts.error;
          parentContacts.data.forEach((contact) => ids.add(contact.id));
        }
      } else if (entityType === "parent") {
        const own = await db
          .from("contacts")
          .select("id")
          .eq("parent_id", entityId);
        if (own.error) throw own.error;
        own.data.forEach((contact) => ids.add(contact.id));
        const links = await db
          .from("parents_students")
          .select("student_id, students(id, first_name, last_name)")
          .eq("parent_id", entityId);
        if (links.error) throw links.error;
        for (const link of links.data) {
          const student = one(link.students);
          children.push({
            id: link.student_id,
            label: personLabel(student, "Student"),
          });
        }
        const studentContacts = await Promise.all(
          links.data.map((row) => getMessageContactsForStudent(row.student_id)),
        );
        for (const contacts of studentContacts) {
          for (const contact of contacts) {
            ids.add(contact.id);
            currentById.set(contact.id, contact.is_current);
          }
        }
      } else {
        const own = await db
          .from("contacts")
          .select("id")
          .eq("staff_id", entityId);
        if (own.error) throw own.error;
        own.data.forEach((contact) => ids.add(contact.id));
      }

      if (ids.size === 0) return { children, contacts: [], conversations: [] };

      const idList = [...ids];
      const contactsResult = await db
        .from("contacts")
        .select(
          "id, phone_e164, email, student_id, parent_id, staff_id, students(first_name,last_name), parents(first_name,last_name), staff(first_name,last_name)",
        )
        .in("id", idList);
      if (contactsResult.error) throw contactsResult.error;
      const contactRows = contactsResult.data as RawContact[];
      const ownContactIds = contactRows
        .filter((row) => contactKind(row) === entityType)
        .map((row) => row.id);

      const groupIds: string[] = [];
      if (ownContactIds.length > 0) {
        const groups = await db
          .from("group_chat_participants")
          .select("conversation_id")
          .in("contact_id", ownContactIds);
        if (groups.error) throw groups.error;
        groupIds.push(
          ...new Set(groups.data.map((row) => row.conversation_id)),
        );
      }
      const filter = `contact_id.in.(${idList.join(",")})${
        groupIds.length ? `,id.in.(${groupIds.join(",")})` : ""
      }`;
      const conversationsResult = await db
        .from("conversations")
        .select(
          "id, contact_id, is_group_chat, group_chat_id, group_chat_name, owned_number_id, owned_numbers(*)",
        )
        .or(filter);
      if (conversationsResult.error) throw conversationsResult.error;

      const contacts = contactRows.map((row) => {
        const kind = contactKind(row);
        const person = one(
          kind === "parent"
            ? row.parents
            : kind === "staff"
              ? row.staff
              : row.students,
        );
        return {
          id: row.id,
          kind,
          label: personLabel(person, row.phone_e164 || row.email || "Contact"),
          phoneE164: row.phone_e164,
          email: row.email,
          isCurrent: currentById.get(row.id) ?? true,
        };
      });

      const conversations = conversationsResult.data.map((row) => ({
        id: row.id,
        contact_id: row.contact_id,
        is_group_chat: row.is_group_chat,
        group_chat_id: row.group_chat_id,
        group_chat_name: row.group_chat_name,
        owned_number_id: row.owned_number_id,
        owned_numbers: one(row.owned_numbers),
      }));

      return { children, contacts, conversations };
    },
  });
}

export function useEntityCommunicationMessages(
  conversations: EntityCommunicationConversation[],
  enabled = true,
) {
  const ids = conversations.map((conversation) => conversation.id).sort();
  return useInfiniteQuery({
    queryKey: ["entity-communication", "messages", ids],
    enabled: enabled && ids.length > 0,
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
        items: data.map((message) => {
          const conversation = conversations.find(
            (item) => item.id === message.conversation_id,
          );
          return {
            ...message,
            sender: conversation?.owned_numbers ?? null,
            conversation_owned_number_id: conversation?.owned_number_id ?? null,
          };
        }),
        next: data.length === 100 ? pageParam + 100 : undefined,
      };
    },
    getNextPageParam: (page) => page.next,
  });
}
