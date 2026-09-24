import { parseUcatFounderOffer, type Tables } from "@altitutor/shared";
import { getSupabaseClient } from "@/shared/lib/supabase/client";

export type FounderOffer = Tables<"ucat_founder_offers"> & {
  ucat_founder_redemptions: Pick<
    Tables<"ucat_founder_redemptions">,
    "id" | "status" | "student_id" | "redeemed_at" | "access_ends_at"
  >[];
};

export async function listFounderOffers(): Promise<FounderOffer[]> {
  const { data, error } = await getSupabaseClient()
    .from("ucat_founder_offers")
    .select(
      "*, ucat_founder_redemptions(id, status, student_id, redeemed_at, access_ends_at)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createFounderOffer(input: unknown): Promise<void> {
  const offer = parseUcatFounderOffer(input);
  if (!offer)
    throw new Error(
      "Check the offer details. Codes can use letters, numbers and hyphens, and any expiry must be in the future.",
    );
  const db = getSupabaseClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Please sign in again.");
  const { data: staff, error: staffError } = await db
    .from("staff")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (staffError) throw new Error(staffError.message);
  const { error } = await db
    .from("ucat_founder_offers")
    .insert({ ...offer, created_by: staff.id });
  if (error)
    throw new Error(
      error.code === "23505"
        ? "That code already exists. Choose another code."
        : error.message,
    );
}

export async function setFounderOfferActive(
  id: string,
  active: boolean,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("ucat_founder_offers")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
