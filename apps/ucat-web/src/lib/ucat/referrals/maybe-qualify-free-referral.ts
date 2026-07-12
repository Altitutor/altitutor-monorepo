import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";

export async function maybeQualifyFreeUcatReferral(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc(
    "maybe_qualify_ucat_free_referral",
    { p_referred_student_id: studentId },
  );

  if (error) {
    console.warn("[ucat referral] Free qualification check failed", error);
    return false;
  }

  return data === true;
}
