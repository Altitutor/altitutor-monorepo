import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { emailAccess } from "@/features/email/server/auth";
export async function GET(request: NextRequest) {
  const access = await emailAccess();
  if ("error" in access)
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  const parsed = z
    .string()
    .trim()
    .email()
    .safeParse(request.nextUrl.searchParams.get("email"));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Email address required." },
      { status: 400 },
    );
  const result = await access.db.rpc("email_people_for_address", {
    p_email: parsed.data.toLowerCase(),
  });
  if (result.error)
    return NextResponse.json(
      { error: "Could not resolve email participant." },
      { status: 503 },
    );
  const matches = result.data.map((person) => ({
    type: person.record_type,
    id: person.record_id,
    label: person.label,
  }));
  return NextResponse.json(
    {
      person: matches.length === 1 ? matches[0] : null,
      ambiguous: matches.length > 1,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const access = await emailAccess();
  if ("error" in access)
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  const input = z
    .object({
      threadId: z.string().min(1),
      email: z.string().email(),
      type: z.enum(["student", "parent", "staff"]),
      id: z.string().guid('Invalid uuid'),
    })
    .safeParse(await request.json().catch(() => null));
  if (!input.success)
    return NextResponse.json(
      { error: "Choose an email participant and contact." },
      { status: 400 },
    );
  const result = await access.db.rpc("email_link_participant", {
    p_thread_id: input.data.threadId,
    p_email: input.data.email,
    p_record_type: input.data.type,
    p_record_id: input.data.id,
  });
  if (result.error)
    return NextResponse.json(
      { error: "Could not link this email participant." },
      { status: 409 },
    );
  return NextResponse.json(result.data);
}
