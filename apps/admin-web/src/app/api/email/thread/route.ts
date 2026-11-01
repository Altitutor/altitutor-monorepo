import { NextRequest, NextResponse } from "next/server";
import { emailThreadSchema } from "@/features/email/types";
import { emailAccess } from "@/features/email/server/auth";
import { resolveDraftReplyTargets } from "@/features/email/server/draft-replies";
import {
  connectMailbox,
  mailboxConfigured,
} from "@/features/email/server/connection";
export async function GET(request: NextRequest) {
  const access = await emailAccess();
  if ("error" in access)
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  const id = request.nextUrl.searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "Thread required." }, { status: 400 });
  const result = await access.db.rpc("email_thread_detail", {
    p_thread_id: id,
  });
  if (result.error)
    return NextResponse.json(
      { error: "Could not load this email conversation." },
      { status: 503 },
    );
  if (!result.data)
    return NextResponse.json(
      { error: "Email conversation not found." },
      { status: 404 },
    );
  const thread = emailThreadSchema.parse(result.data);
  if (mailboxConfigured())
    thread.messages = await resolveDraftReplyTargets(
      access.admin,
      thread.messages,
      connectMailbox,
      access.mailbox.address,
    );
  const attempts = await access.db
    .from("email_send_attempts")
    .select("message_id,state,updated_at,scheduled_at,command_id")
    .in(
      "message_id",
      thread.messages.map((message) => message.id),
    )
    .order("updated_at", { ascending: true });
  if (attempts.error)
    return NextResponse.json(
      { error: "Could not load email send outcomes." },
      { status: 503 },
    );
  return NextResponse.json(
    {
      ...thread,
      sends: [
        ...new Map(
          attempts.data.map((attempt) => [attempt.message_id, attempt]),
        ).values(),
      ],
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
