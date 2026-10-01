import { NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server-ssr";

export async function POST() {
  try {
    const client = createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: allowed } = await client.rpc("is_adminstaff_active");
    if (!allowed)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const origin =
      process.env.MARKETING_APP_ORIGIN ??
      (process.env.NODE_ENV === "development"
        ? "http://localhost:3003"
        : process.env.VERCEL_ENV === "preview"
          ? "https://development.altitutor.com"
          : "https://altitutor.com");
    const response = await fetch(`${origin}/api/staff/refresh/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Marketing refresh failed");
    return NextResponse.json({ refreshed: true });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not refresh the website. Saved changes will appear after the next automatic refresh.",
      },
      { status: 502 },
    );
  }
}
