import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import {
  STAFF_PROFILES_TAG,
  staffDatabaseConfig,
} from "@/features/staff/server/profiles";

export async function POST(request: Request) {
  const config = staffDatabaseConfig();
  if (!config)
    return NextResponse.json(
      { error: "Staff profiles are not configured" },
      { status: 503 },
    );
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // Supabase verifies the JWT and the database checks current active admin
    // membership. Never trust client-supplied role claims or user metadata.
    const response = await fetch(
      `${config.url}/rest/v1/rpc/is_adminstaff_active`,
      {
        method: "POST",
        headers: {
          apikey: config.key,
          authorization,
          "Content-Type": "application/json",
        },
        body: "{}",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok || (await response.json()) !== true)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    revalidateTag(STAFF_PROFILES_TAG);
    revalidatePath("/about/");
    return NextResponse.json({ refreshed: true });
  } catch {
    return NextResponse.json(
      { error: "Website refresh failed" },
      { status: 502 },
    );
  }
}
