import "server-only";
import { createClient } from "@/shared/lib/supabase/server-ssr";
import { getServerSupabaseAdmin } from "@/shared/lib/supabase/server";

export async function emailAccess() {
  const db = createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 } as const;
  const active = await db.rpc("is_adminstaff_active");
  if (active.error || !active.data)
    return { error: "Forbidden", status: 403 } as const;
  const staff = await db
    .from("staff")
    .select("id,first_name,last_name")
    .eq("user_id", user.id)
    .eq("role", "ADMINSTAFF")
    .eq("status", "ACTIVE")
    .single();
  const admin = getServerSupabaseAdmin();
  if (staff.error || !staff.data || !admin)
    return { error: "Server configuration unavailable", status: 503 } as const;
  return { db, admin, staff: staff.data };
}
