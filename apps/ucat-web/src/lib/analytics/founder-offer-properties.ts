import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Stable cohort labels for product events, independent of current subscription state. */
export async function founderOfferProperties(
  userId: string,
): Promise<Record<string, string>> {
  if (!supabaseAdmin) return {};
  try {
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!student) return {};
    const { data, error } = await supabaseAdmin
      .from("ucat_founder_redemptions")
      .select("kind, ucat_founder_offers(id, code, campaign)")
      .eq("student_id", student.id)
      .eq("status", "redeemed");
    if (error) return {};
    const properties: Record<string, string> = {};
    for (const claim of data ?? []) {
      const offer = claim.ucat_founder_offers;
      if (!offer) continue;
      const prefix =
        claim.kind === "access_pass" ? "founder_access" : "founder_discount";
      properties[`${prefix}_offer_id`] = offer.id;
      properties[`${prefix}_code`] = offer.code;
      properties[`${prefix}_campaign`] = offer.campaign;
    }
    return properties;
  } catch {
    return {};
  }
}
