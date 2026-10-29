import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { escapeIlikePattern } from "@altitutor/shared";
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
    .email()
    .safeParse(request.nextUrl.searchParams.get("email"));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Email address required." },
      { status: 400 },
    );
  const email = parsed.data.trim().toLowerCase();
  const reviewed = await access.db
    .from("email_participant_links")
    .select("record_type,record_id")
    .eq("email", email)
    .maybeSingle();
  if (reviewed.error)
    return NextResponse.json(
      { error: "Could not resolve email participant." },
      { status: 503 },
    );
  const requests = await Promise.all([
    reviewed.data
      ? access.db
          .from("students")
          .select("id,first_name,last_name")
          .eq(
            "id",
            reviewed.data.record_type === "student"
              ? reviewed.data.record_id
              : "00000000-0000-0000-0000-000000000000",
          )
          .is("deleted_at", null)
      : access.db
          .from("students")
          .select("id,first_name,last_name")
          .ilike("email", escapeIlikePattern(email))
          .is("deleted_at", null)
          .limit(2),
    reviewed.data
      ? access.db
          .from("parents")
          .select("id,first_name,last_name")
          .eq(
            "id",
            reviewed.data.record_type === "parent"
              ? reviewed.data.record_id
              : "00000000-0000-0000-0000-000000000000",
          )
      : access.db
          .from("parents")
          .select("id,first_name,last_name")
          .ilike("email", escapeIlikePattern(email))
          .limit(2),
    reviewed.data
      ? access.db
          .from("staff")
          .select("id,first_name,last_name")
          .eq(
            "id",
            reviewed.data.record_type === "staff"
              ? reviewed.data.record_id
              : "00000000-0000-0000-0000-000000000000",
          )
      : access.db
          .from("staff")
          .select("id,first_name,last_name")
          .ilike("email", escapeIlikePattern(email))
          .limit(2),
  ]);
  if (requests.some((result) => result.error))
    return NextResponse.json(
      { error: "Could not resolve email participant." },
      { status: 503 },
    );
  const kinds = ["student", "parent", "staff"] as const;
  const matches = requests.flatMap((result, index) =>
    (result.data ?? []).map((person) => ({
      type: kinds[index],
      id: person.id,
      label:
        [person.first_name, person.last_name].filter(Boolean).join(" ") ||
        email,
    })),
  );
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
      id: z.string().uuid(),
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
