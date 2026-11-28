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
  if (type !== "email" && type !== "message" && type !== "invoice" && type !== "adminShift" && type !== "tutorLog")
    return NextResponse.json(
      { error: "Invalid reference type" },
      { status: 400 },
    );
  if (search.length < 2) return NextResponse.json([]);
  if (type === "invoice") {
    let query = db.from("invoices").select("id,stripe_invoice_number,status")
      .is("deleted_at", null).order("id").limit(8);
    for (const filter of buildPersonFieldOrFilters(search, ["stripe_invoice_number", "stripe_invoice_id"])) {
      query = query.or(filter);
    }
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Search unavailable" }, { status: 503 });
    return referenceResults(type, (data ?? []).map((row) => ({
      id: row.id, title: row.stripe_invoice_number || "Invoice", subtitle: row.status,
    })));
  }
  if (type === "adminShift") {
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const terms = search.toLowerCase().split(/[\s–—-]+/).filter(Boolean);
    let query = db.from("admin_shifts").select("id,day_of_week,start_time,end_time,status")
      .is("deleted_at", null).order("day_of_week").order("start_time").limit(8);
    for (const term of terms) {
      if ("admin".startsWith(term) || "shift".startsWith(term) || term === "shifts") continue;
      const days = weekdays.flatMap((day, index) => day.toLowerCase().startsWith(term) ? [index] : []);
      if (days.length) {
        query = query.in("day_of_week", days);
      } else if (/^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(term)) {
        const time = term.padStart(5, "0");
        query = query.or(`start_time.eq.${time},end_time.eq.${time}`);
      } else {
        for (const filter of buildPersonFieldOrFilters(term, ["status"])) query = query.or(filter);
      }
    }
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Search unavailable" }, { status: 503 });
    return referenceResults(type, (data ?? []).map((row) => ({
      id: row.id, title: `${weekdays[row.day_of_week]} admin shift`,
      subtitle: `${row.start_time.slice(0, 5)} – ${row.end_time.slice(0, 5)}`,
    })));
  }
  if (type === "tutorLog") {
    let query = db.from("tutor_logs").select("id,session_type,sessions!inner(short_name,long_name,start_at)")
      .is("deleted_at", null).order("created_at", { ascending: false }).limit(8);
    if (!"tutor log".includes(search.toLowerCase())) {
      for (const filter of buildPersonFieldOrFilters(search, ["short_name", "long_name"])) {
        query = query.or(filter, { referencedTable: "sessions" });
      }
    }
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Search unavailable" }, { status: 503 });
    return referenceResults(type, (data ?? []).map((row) => ({
      id: row.id, title: row.sessions.short_name || row.sessions.long_name || "Tutor log",
      subtitle: row.sessions.start_at ? new Date(row.sessions.start_at).toLocaleDateString("en-AU", { timeZone: "Australia/Adelaide" }) : null,
    })));
  }
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

function referenceResults(type: "invoice" | "adminShift" | "tutorLog", rows: { id: string; title: string; subtitle: string | null }[]) {
  return NextResponse.json(
    rows.map(({ id, ...data }) => ({ type, id, data })),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
