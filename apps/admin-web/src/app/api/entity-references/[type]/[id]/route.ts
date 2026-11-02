import { NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server-ssr";
import { emailAccess } from "@/features/email/server/auth";
import { referenceDetails } from "@/features/entity-references/server/details";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const active = await db.rpc("is_adminstaff_active");
  if (active.error || !active.data)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { type, id } = await params;
  if (
    id.length > 2048 ||
    (type !== "email" &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      ))
  )
    return NextResponse.json({ error: "Invalid reference" }, { status: 400 });
  if (type === "email") {
    const access = await emailAccess();
    if ("error" in access)
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
  }
  try {
    const details = await referenceDetails(db, type, id);
    return NextResponse.json(details ?? { error: "Reference not found" }, {
      status: details ? 200 : 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Reference unavailable" },
      { status: 503 },
    );
  }
}
