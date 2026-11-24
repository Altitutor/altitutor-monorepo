"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import type { BookMeetingContact } from "@/features/messages/utils/getBookMeetingOptions";
import type { EmailThread } from "../types";

export function emailConversationPerson(thread: EmailThread | undefined) {
  const people = thread?.links.flatMap(({ recordType, recordId, source, label }) =>
    recordType === "student" || recordType === "parent" || recordType === "staff"
      ? [{ type: recordType, id: recordId, source, label }]
      : [],
  );
  return people?.find((person) => person.source === "direct") ?? people?.[0];
}

export function useEmailConversationContact(thread: EmailThread | undefined) {
  const person = emailConversationPerson(thread);
  return useQuery({
    queryKey: [
      "email",
      "conversation-contact",
      person?.type,
      person?.id,
    ],
    enabled: !!person,
    queryFn: async (): Promise<BookMeetingContact> => {
      if (!person) return null;
      const db = getSupabaseClient();
      if (person.type === "student") {
        const { data, error } = await db
          .from("students")
          .select("id,first_name,last_name,phone")
          .eq("id", person.id)
          .single();
        if (error) throw error;
        return { students: data, phone_e164: data.phone };
      }
      if (person.type === "parent") {
        const { data, error } = await db
          .from("parents")
          .select("id,first_name,last_name,phone")
          .eq("id", person.id)
          .single();
        if (error) throw error;
        return { parents: data, phone_e164: data.phone };
      }
      if (person.type === "staff") {
        const { data, error } = await db
          .from("staff")
          .select("id,first_name,last_name,phone_number,role")
          .eq("id", person.id)
          .single();
        if (error) throw error;
        return { staff: data, phone_e164: data.phone_number };
      }
      return null;
    },
  });
}
