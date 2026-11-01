import "server-only";
import type { Database } from "@altitutor/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MailboxPolicy } from "@altitutor/email";
import { getMailboxPolicy } from "./config";
export async function ensureMailboxIdentity(
  db: SupabaseClient<Database>,
  policy: MailboxPolicy = getMailboxPolicy(),
) {
  const result = await db.rpc("email_assert_mailbox", {
    p_address: policy.address,
  });
  if (result.error)
    throw new Error(
      "Mailbox identity differs from the database binding or is unavailable. Existing mail was preserved.",
    );
  if (result.data !== policy.address)
    throw new Error("The mailbox database identity could not be verified.");
  return policy;
}
