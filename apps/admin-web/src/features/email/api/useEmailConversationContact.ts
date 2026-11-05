"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import type { BookMeetingContact } from "@/features/messages/utils/getBookMeetingOptions";
import type { EmailThread } from "../types";

export function useEmailConversationContact(thread: EmailThread | undefined) {
  const people =
    thread?.links.filter((link) =>
      ["student", "parent", "staff"].includes(link.recordType),
    ) ?? [];
  const person = people.find((link) => link.source === "direct") ?? people[0];
  return useQuery({
    queryKey: [
      "email",
      "conversation-contact",
      person?.recordType,
      person?.recordId,
    ],
    enabled: !!person,
    queryFn: async (): Promise<BookMeetingContact> => {
      if (!person) return null;
      const db = getSupabaseClient();
      if (person.recordType === "student") {
        const { data, error } = await db
          .from("students")
          .select("id,first_name,last_name,phone")
          .eq("id", person.recordId)
          .single();
        if (error) throw error;
        return { students: data, phone_e164: data.phone };
      }
      if (person.recordType === "parent") {
        const { data, error } = await db
          .from("parents")
          .select("id,first_name,last_name,phone")
          .eq("id", person.recordId)
          .single();
        if (error) throw error;
        return { parents: data, phone_e164: data.phone };
      }
      if (person.recordType === "staff") {
        const { data, error } = await db
          .from("staff")
          .select("id,first_name,last_name,phone_number,role")
          .eq("id", person.recordId)
          .single();
        if (error) throw error;
        return { staff: data, phone_e164: data.phone_number };
      }
      return null;
    },
  });
}
