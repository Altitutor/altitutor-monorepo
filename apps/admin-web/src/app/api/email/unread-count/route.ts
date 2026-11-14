import { NextResponse } from "next/server";
import { emailStaffAccess } from "@/features/email/server/auth";
import { getMailboxPolicy } from "@/features/email/server/config";

function countResponse(count: number) {
  return NextResponse.json({ count }, { headers: { "Cache-Control": "private, no-store" } });
}

function unavailable() {
  return NextResponse.json({ error: "Could not load the unread mail count." }, { status: 503 });
}

export async function GET() {
  const access = await emailStaffAccess();
  if (access.error !== undefined) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // The sidebar can read an existing mailbox binding without initializing one.
  const identity = await access.admin
    .from("email_mailbox_identity")
    .select("address")
    .eq("singleton", true)
    .maybeSingle();
  if (identity.error) return unavailable();
  if (!identity.data) return countResponse(0);
  try {
    if (identity.data.address !== getMailboxPolicy().address) return unavailable();
  } catch {
    return unavailable();
  }

  const folders = await access.db
    .from("email_folders")
    .select("id")
    .eq("role", "inbox")
    .eq("present", true);
  if (folders.error) return unavailable();
  if (!folders.data.length) return countResponse(0);

  const { count, error } = await access.db
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .in("folder_id", folders.data.map(({ id }) => id))
    .eq("removed", false)
    .not("data", "cs", '{"read":true}')
    .not("data", "cs", '{"draft":true}');

  if (error || count === null) return unavailable();
  return countResponse(count);
}
