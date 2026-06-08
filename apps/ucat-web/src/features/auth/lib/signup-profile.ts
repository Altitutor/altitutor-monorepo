import { supabaseAdmin } from "@/lib/supabase/admin";

export const PROFILE_SETUP_COMPLETE_KEY = "profile_setup_complete";

export interface SignupProfileInitial {
  firstName: string;
  lastName: string;
  phone: string;
}

export function isProfileSetupComplete(
  userMetadata: Record<string, unknown> | undefined,
): boolean {
  return userMetadata?.[PROFILE_SETUP_COMPLETE_KEY] === true;
}

export async function loadSignupProfileInitial(
  userId: string,
): Promise<SignupProfileInitial> {
  if (!supabaseAdmin) {
    return { firstName: "", lastName: "", phone: "" };
  }

  const { data: student } = await supabaseAdmin
    .from("students")
    .select("first_name, last_name, phone")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    firstName: student?.first_name?.trim() ?? "",
    lastName: student?.last_name?.trim() ?? "",
    phone: student?.phone?.trim() ?? "",
  };
}
