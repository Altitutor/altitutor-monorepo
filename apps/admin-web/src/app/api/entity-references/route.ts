import { NextResponse } from "next/server";
import { buildPersonFieldOrFilters } from "@altitutor/shared";
import { createClient } from "@/shared/lib/supabase/server-ssr";
import { emailAccess } from "@/features/email/server/auth";
import { emailMessageSchema } from "@/features/email/types";
export async function GET(request: Request) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const active = await db.rpc("is_adminstaff_active");
  if (active.error || !active.data)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  const search = (params.get("search") ?? "").trim().slice(0, 300);
  if (type !== "email" && type !== "message")
    return NextResponse.json(
      { error: "Invalid reference type" },
      { status: 400 },
    );
  if (search.length < 2) return NextResponse.json([]);
  if (type === "email") {
    const access = await emailAccess();
    if ("error" in access)
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    let query = db
      .from("email_messages")
      .select("id,data")
      .eq("removed", false)
      .order("occurred_at", { ascending: false })
      .limit(20);
    for (const filter of buildPersonFieldOrFilters(search, [
      "data->>subject",
      "data->>bodyText",
      "data->>sender",
    ]))
      query = query.or(filter);
    const result = await query;
    if (result.error)
      return NextResponse.json(
        { error: "Search unavailable" },
        { status: 503 },
      );
    return NextResponse.json(
      (result.data ?? []).flatMap((row) => {
        const email = emailMessageSchema.safeParse(row.data);
        return email.success && !email.data.draft
          ? [
              {
                type,
                id: row.id,
                data: {
                  title: email.data.subject || "No subject",
                  subtitle: email.data.sender,
                },
              },
            ]
          : [];
      }),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
  let query = db
    .from("messages")
    .select("id,body,from_number_e164")
    .eq("is_reaction", false)
    .order("created_at", { ascending: false })
    .limit(20);
  for (const filter of buildPersonFieldOrFilters(search, [
    "body",
    "from_number_e164",
    "to_number_e164",
  ]))
    query = query.or(filter);
  const result = await query;
  if (result.error)
    return NextResponse.json({ error: "Search unavailable" }, { status: 503 });
  return NextResponse.json(
    (result.data ?? []).map((row) => ({
      type,
      id: row.id,
      data: {
        title: row.body.slice(0, 120) || "Message",
        subtitle: row.from_number_e164,
      },
    })),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
