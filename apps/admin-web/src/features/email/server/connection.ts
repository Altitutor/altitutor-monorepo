import "server-only";
import { z } from "zod";
import { createGraphMailbox } from "./graph";
import { getMailboxPolicy } from "./config";
import { ensureMailboxIdentity } from "./identity";
import { getServerSupabaseAdmin } from "@/shared/lib/supabase/server";

export function mailboxConfigured() {
  return Boolean(
    process.env.EMAIL_M365_TENANT_ID &&
      process.env.EMAIL_M365_CLIENT_ID &&
      process.env.EMAIL_M365_CLIENT_SECRET,
  );
}
export async function getMailboxAccessToken() {
  const tenant = process.env.EMAIL_M365_TENANT_ID;
  const client = process.env.EMAIL_M365_CLIENT_ID;
  const secret = process.env.EMAIL_M365_CLIENT_SECRET;
  if (!tenant || !client || !secret)
    throw new Error("Microsoft 365 mailbox credentials are not configured.");
  const response = await fetch(
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
  if (!response.ok)
    throw new Error(`Microsoft 365 authorization failed (${response.status}).`);
  const token = z
    .object({ access_token: z.string() })
    .parse(await response.json());
  return token.access_token;
}

export async function connectMailbox() {
  const db = getServerSupabaseAdmin();
  if (!db) throw new Error("Mailbox database is not configured.");
  const mailbox = await ensureMailboxIdentity(db, getMailboxPolicy());
  return createGraphMailbox({
    mailbox,
    accessToken: await getMailboxAccessToken(),
  });
}
