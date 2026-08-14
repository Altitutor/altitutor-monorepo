import { supabaseAdmin } from "@/lib/supabase/admin";

export type ActiveStaffRole = "ADMINSTAFF" | "TUTOR";

function isActiveStaffRole(value: unknown): value is ActiveStaffRole {
  return value === "ADMINSTAFF" || value === "TUTOR";
}

export async function loadActiveStaffRole(
  userId: string,
): Promise<ActiveStaffRole | null> {
  if (!supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from("staff")
    .select("role")
    .eq("user_id", userId)
    .in("status", ["ACTIVE", "TRIAL"])
    .maybeSingle();

  if (error || !isActiveStaffRole(data?.role)) return null;
  return data.role;
}
