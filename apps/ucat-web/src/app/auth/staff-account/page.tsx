import { redirect } from "next/navigation";
import { StaffAccountNotice } from "@/features/auth/components/staff-account-notice";
import { loadActiveStaffRole } from "@/features/auth/server/active-staff";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function StaffAccountPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = await loadActiveStaffRole(user.id);
  if (!role) redirect("/dashboard");

  return <StaffAccountNotice role={role} />;
}
