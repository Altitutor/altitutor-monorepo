import { NextResponse } from "next/server";
import { emailAccess } from "@/features/email/server/auth";
export async function GET() {
  const access = await emailAccess();
  if ("error" in access)
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  const result = await access.admin
    .from("email_operational_sends")
    .select("id,state,payload,draft_id,updated_at")
    .neq("state", "sent")
    .order("created_at")
    .limit(100);
  if (result.error)
    return NextResponse.json(
      { error: "Could not load operational email outcomes." },
      { status: 503 },
    );
  const ids = result.data.flatMap((row) =>
    row.draft_id ? [row.draft_id] : [],
  );
  const messages = ids.length
    ? await access.db
        .from("email_messages")
        .select("id,thread_id")
        .in("id", ids)
    : { data: [], error: null };
  if (messages.error)
    return NextResponse.json(
      { error: "Could not load operational email conversations." },
      { status: 503 },
    );
  return NextResponse.json(
    result.data.map((row) => {
      const payload =
        row.payload &&
        typeof row.payload === "object" &&
        !Array.isArray(row.payload)
          ? row.payload
          : {};
      const email =
        payload.email &&
        typeof payload.email === "object" &&
        !Array.isArray(payload.email)
          ? payload.email
          : {};
      return {
        id: row.id,
        state: row.state,
        subject:
          typeof email.subject === "string"
            ? email.subject
            : "Operational email",
        to: Array.isArray(payload.to)
          ? payload.to.filter(
              (address): address is string => typeof address === "string",
            )
          : [],
        threadId:
          messages.data.find((message) => message.id === row.draft_id)
            ?.thread_id ?? null,
        updatedAt: row.updated_at,
      };
    }),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
