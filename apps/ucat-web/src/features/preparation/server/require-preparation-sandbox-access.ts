import "server-only";

import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function requirePreparationSandboxAccess(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=%2Fpreparation-sandbox");
  }

  const { data: isAdminStaff, error } = await supabase.rpc(
    "is_adminstaff_active",
  );
  if (error || !isAdminStaff) notFound();
}
