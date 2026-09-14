import "server-only";
import { z } from "zod";
import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

const address = z.object({ emailAddress: z.object({ address: z.string() }) });
const message = z.object({
  id: z.string(),
  subject: z.string().optional(),
  body: z.object({ content: z.string() }).optional(),
  from: address.optional(),
  toRecipients: z.array(address).optional(),
  ccRecipients: z.array(address).optional(),
  receivedDateTime: z.string().optional(),
  sentDateTime: z.string().optional(),
  isDraft: z.boolean().optional(),
  internetMessageId: z.string().optional(),
  conversationId: z.string().optional(),
  "@removed": z.unknown().optional(),
});
const pageSchema = z.object({
  value: z.array(message),
  "@odata.nextLink": z.string().optional(),
  "@odata.deltaLink": z.string().optional(),
});
const folderSchema = z.object({
  value: z.array(z.object({ id: z.string(), childFolderCount: z.number() })),
  "@odata.nextLink": z.string().optional(),
});
const mailbox = "admin@altitutor.com";
export async function syncOnboardingMailbox(db: SupabaseClient<Database>) {
  const tenant = process.env.ONBOARDING_M365_TENANT_ID;
  const client = process.env.ONBOARDING_M365_CLIENT_ID;
  const secret = process.env.ONBOARDING_M365_CLIENT_SECRET;
  if (!tenant || !client || !secret)
    throw new Error("Microsoft 365 mailbox credentials are not configured.");
  const auth = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
      method: "POST",
      body: new URLSearchParams({
        client_id: client,
        client_secret: secret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    },
  );
  if (!auth.ok)
    throw new Error(`Microsoft 365 authorization failed (${auth.status}).`);
  const token = z
    .object({ access_token: z.string() })
    .parse(await auth.json()).access_token;
  const base = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}`;
  async function read(url: string) {
    const parsed = new URL(url);
    if (parsed.origin !== "https://graph.microsoft.com")
      throw new Error("Unexpected Microsoft Graph continuation URL.");
    const result = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer:
          'IdType="ImmutableId", outlook.body-content-type="text", odata.maxpagesize=100',
      },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!result.ok)
      throw new Error(`Microsoft Graph request failed (${result.status}).`);
    return result.json();
  }
  const folders: string[] = [];
  const queue = [
    `${base}/mailFolders?includeHiddenFolders=false&$top=100&$select=id,childFolderCount`,
  ];
  while (queue.length) {
    const result = folderSchema.parse(await read(queue.shift()!));
    for (const folder of result.value) {
      folders.push(folder.id);
      if (folder.childFolderCount)
        queue.push(
          `${base}/mailFolders/${encodeURIComponent(folder.id)}/childFolders?$top=100&$select=id,childFolderCount`,
        );
    }
    if (result["@odata.nextLink"]) queue.push(result["@odata.nextLink"]);
  }
  const states = await db.from("onboarding_mailbox_sync").select("*");
  if (states.error) throw states.error;
  // Resume oldest folder first so large initial imports cannot starve other folders.
  folders.sort((a, b) =>
    (states.data.find((s) => s.folder === a)?.synced_at ?? "").localeCompare(
      states.data.find((s) => s.folder === b)?.synced_at ?? "",
    ),
  );
  let imported = 0;
  let pages = 0;
  for (const folder of folders) {
    if (pages >= 10) break;
    const state = states.data.find((s) => s.folder === folder);
    const first = `${base}/mailFolders/${encodeURIComponent(folder)}/messages/delta?$select=id,subject,body,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,internetMessageId,conversationId,isDraft`;
    let url = state?.cursor_url ?? first;
    do {
      const page = pageSchema.parse(await read(url));
      pages++;
      const rows = page.value.flatMap((m) => {
        if (m["@removed"] || m.isDraft || !m.from || !m.receivedDateTime)
          return [];
        const sender = m.from.emailAddress.address.toLowerCase();
        const outbound = sender === mailbox;
        return [
          {
            id: m.id,
            internet_message_id: m.internetMessageId ?? null,
            conversation_id: m.conversationId ?? null,
            subject: m.subject ?? "",
            body_text: m.body?.content ?? "",
            sender,
            recipients: [
              ...(m.toRecipients ?? []),
              ...(m.ccRecipients ?? []),
            ].map((r) => r.emailAddress.address.toLowerCase()),
            occurred_at: outbound
              ? (m.sentDateTime ?? m.receivedDateTime)
              : m.receivedDateTime,
            direction: outbound ? "outbound" : "inbound",
            delivery_status: outbound ? "sent" : "received",
          },
        ];
      });
      if (rows.length) {
        const old = await db
          .from("onboarding_emails")
          .select("id,ignored")
          .in(
            "id",
            rows.map((m) => m.id),
          );
        if (old.error) throw old.error;
        const result = await db.from("onboarding_emails").upsert(
          rows.map((m) => ({
            ...m,
            ignored: old.data.find((r) => r.id === m.id)?.ignored ?? false,
          })),
        );
        if (result.error) throw result.error;
        imported += rows.length;
      }
      const cursor = page["@odata.nextLink"] ?? page["@odata.deltaLink"];
      if (!cursor) throw new Error("Microsoft Graph omitted its sync cursor.");
      // Commit cursor only after the whole page is stored; retries are idempotent.
      const saved = await db.from("onboarding_mailbox_sync").upsert({
        folder,
        cursor_url: cursor,
        synced_at: new Date().toISOString(),
        last_error: null,
      });
      if (saved.error) throw saved.error;
      url = page["@odata.nextLink"] ?? "";
    } while (url && pages < 10);
  }
  return { imported, pages, folders: folders.length };
}
