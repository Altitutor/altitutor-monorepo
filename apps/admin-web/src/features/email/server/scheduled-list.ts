import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { emailMessageSchema, type EmailSummary } from "../types";

/** Scheduled is a portal view, never a fabricated Microsoft folder. */
export async function listScheduledMail(
  db: SupabaseClient<Database>,
  options: {
    search: string;
    assignees: string[];
    offset: number;
    sort: string;
    direction: string;
  },
) {
  const rows = new Map<string, EmailSummary>();
  for (let offset = 0; ; offset += 25) {
    const attempts = await db
      .from("email_send_attempts")
      .select("message_id,scheduled_at")
      .in("state", ["scheduled", "paused"])
      .order("scheduled_at")
      .order("message_id")
      .range(offset, offset + 24);
    if (attempts.error) throw new Error("Could not load scheduled emails.");
    if (!attempts.data.length) break;
    const messages = await db
      .from("email_messages")
      .select("id,thread_id,data")
      .eq("removed", false)
      .in(
        "id",
        attempts.data.map((item) => item.message_id),
      );
    if (messages.error) throw new Error("Could not load scheduled emails.");
    const ids = [...new Set(messages.data.map((message) => message.thread_id))];
    const threads = ids.length
      ? await db
          .from("email_threads")
          .select("id,assigned_staff_id")
          .in("id", ids)
      : { data: [], error: null };
    if (threads.error) throw new Error("Could not load scheduled emails.");
    for (const item of messages.data) {
      const message = emailMessageSchema.parse(item.data);
      const assignee =
        threads.data.find((thread) => thread.id === item.thread_id)
          ?.assigned_staff_id ?? null;
      if (
        !options.assignees.includes("all") &&
        !options.assignees.includes(assignee ?? "unassigned")
      )
        continue;
      if (
        options.search &&
        ![message.subject, message.bodyText, message.sender, ...message.to]
          .join(" ")
          .toLowerCase()
          .includes(options.search.toLowerCase())
      )
        continue;
      const previous = rows.get(item.thread_id);
      const at =
        attempts.data.find((attempt) => attempt.message_id === message.id)
          ?.scheduled_at ?? null;
      const summary: EmailSummary = {
        id: item.thread_id,
        messageIds: [...(previous?.messageIds ?? []), message.id],
        subject: message.subject,
        preview: message.bodyText.slice(0, 240),
        sender: message.sender,
        senderName: message.senderName ?? null,
        at,
        read: Boolean(message.read),
        draft: true,
        assignedStaffId: assignee,
      };
      rows.set(
        item.thread_id,
        previous
          ? {
              ...previous,
              messageIds: summary.messageIds,
              read: previous.read && summary.read,
            }
          : summary,
      );
    }
    if (attempts.data.length < 25) break;
  }
  const direction = options.direction === "asc" ? 1 : -1;
  const sorted = [...rows.values()].sort(
    (a, b) =>
      direction *
        (options.sort === "sender"
          ? a.sender.toLowerCase().localeCompare(b.sender.toLowerCase())
          : (a.at ?? "").localeCompare(b.at ?? "")) || a.id.localeCompare(b.id),
  );
  return {
    threads: sorted.slice(options.offset, options.offset + 50),
    hasMore: sorted.length > options.offset + 50,
  };
}
