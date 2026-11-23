import "server-only";
import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { EmailSummary } from "../types";

const replySchema = z.object({
  sentAt: z.string(),
  to: z.array(z.string()).nullish(),
  cc: z.array(z.string()).nullish(),
  replyToMessageId: z.string().nullish(),
  draftMode: z.string().nullish(),
});

/** Find the latest shared-mailbox reply to the visible incoming conversation. */
export async function getInboxReplyTimes(
  db: SupabaseClient<Database>,
  rows: EmailSummary[],
  mailboxAddress: string,
) {
  const inbound = new Map(rows.flatMap((row) =>
    row.at && !row.draft && row.sender && row.sender.toLowerCase() !== mailboxAddress
      ? [[row.id, row] as const]
      : [],
  ));
  const candidateTimes = new Map<string, string>();
  if (!inbound.size) return candidateTimes;
  const earliest = rows.reduce(
    (first, row) => row.at ? Math.min(first, Date.parse(row.at)) : first,
    Infinity,
  );
  if (!Number.isFinite(earliest)) return candidateTimes;

  const pageSize = 250;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db
      .from("email_messages")
      .select("thread_id,sentAt:data->>sentAt,to:data->to,cc:data->cc,replyToMessageId:data->>replyToMessageId,draftMode:data->>draftMode")
      .in("thread_id", [...inbound.keys()])
      .eq("removed", false)
      .eq("data->>sender", mailboxAddress)
      .eq("data->>draft", "false")
      .gt("occurred_at", new Date(earliest).toISOString())
      .order("occurred_at", { ascending: false })
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    for (const item of data) {
      const incoming = inbound.get(item.thread_id);
      const reply = replySchema.safeParse(item);
      if (!incoming?.at || !reply.success || reply.data.draftMode === "forward") continue;
      const { sentAt, to, cc, replyToMessageId } = reply.data;
      const sent = Date.parse(sentAt);
      if (!(sent > Date.parse(incoming.at))) continue;

      // Outlook-originated messages lack the portal's draft target metadata.
      // Use the shared conversation and outgoing recipients for those messages.
      const addressedToSender = [...(to ?? []), ...(cc ?? [])]
        .some((address) => address.toLowerCase() === incoming.sender.toLowerCase());
      if (replyToMessageId ? !incoming.messageIds.includes(replyToMessageId) : !addressedToSender) continue;
      const previous = candidateTimes.get(incoming.id);
      if (!previous || sent > Date.parse(previous)) candidateTimes.set(incoming.id, sentAt);
    }
    if (data.length < pageSize) return candidateTimes;
  }
}
