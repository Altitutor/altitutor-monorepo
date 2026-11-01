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
type TokenCache = {
  identity: string;
  expires: number;
  token?: string;
  pending?: Promise<string>;
};
let tokenCache: TokenCache | undefined;
export async function getMailboxAccessToken() {
  const tenant = process.env.EMAIL_M365_TENANT_ID;
  const client = process.env.EMAIL_M365_CLIENT_ID;
  const secret = process.env.EMAIL_M365_CLIENT_SECRET;
  if (!tenant || !client || !secret)
    throw new Error("Microsoft 365 mailbox credentials are not configured.");
  // Reuse the opaque token until shortly before the provider's reported expiry.
  // Rotation changes identity immediately; concurrent commands share one request.
  const identity = JSON.stringify([tenant, client, secret]);
  if (tokenCache?.identity === identity) {
    if (tokenCache.pending) return tokenCache.pending;
    if (tokenCache.token && tokenCache.expires > Date.now())
      return tokenCache.token;
  }
  const entry: TokenCache = { identity, expires: 0 };
  tokenCache = entry;
  entry.pending = (async () => {
    const started = Date.now();
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
      throw new Error(
        `Microsoft 365 authorization failed (${response.status}).`,
      );
    const token = z
      .object({
        access_token: z.string(),
        expires_in: z.number().nonnegative().optional(),
      })
      .parse(await response.json());
    entry.token = token.access_token;
    entry.expires = started + Math.max(0, (token.expires_in ?? 0) - 60) * 1000;
    return token.access_token;
  })();
  try {
    return await entry.pending;
  } finally {
    entry.pending = undefined;
  }
}

export async function connectMailbox(requestSignal?: AbortSignal) {
  const db = getServerSupabaseAdmin();
  if (!db) throw new Error("Mailbox database is not configured.");
  const mailbox = await ensureMailboxIdentity(db, getMailboxPolicy());
  const accessToken = await getMailboxAccessToken();
  requestSignal?.throwIfAborted();
  return createGraphMailbox({ mailbox, accessToken, requestSignal });
}
