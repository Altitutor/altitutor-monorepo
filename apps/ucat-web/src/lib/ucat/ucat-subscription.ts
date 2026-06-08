import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { getUcatSubjectId } from "@/lib/ucat/ucat-subject-id";

export const MANAGEABLE_UCAT_SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "unpaid",
] as const;

export type UcatSubscriptionRow = {
  id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
  stripe_subscription_id: string;
  stripe_price_id: string | null;
  plan_tier: string | null;
  billing_interval: string | null;
  created_at: string;
  updated_at: string;
};

export async function getStudentIdForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function getUcatSubscriptionForStudent(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<UcatSubscriptionRow | null> {
  const ucatSubjectId = await getUcatSubjectId(supabase);
  if (!ucatSubjectId) return null;

  const { data } = await supabase
    .from("student_subscriptions")
    .select(
      "id, status, current_period_start, current_period_end, cancel_at_period_end, cancel_at, stripe_subscription_id, stripe_price_id, plan_tier, billing_interval, created_at, updated_at",
    )
    .eq("student_id", studentId)
    .eq("subject_id", ucatSubjectId)
    .in("status", [...MANAGEABLE_UCAT_SUBSCRIPTION_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.id || !data.status || !data.stripe_subscription_id) {
    return null;
  }

  return {
    id: data.id,
    status: data.status,
    current_period_start: data.current_period_start,
    current_period_end: data.current_period_end,
    cancel_at_period_end: data.cancel_at_period_end ?? false,
    cancel_at: data.cancel_at,
    stripe_subscription_id: data.stripe_subscription_id,
    stripe_price_id: data.stripe_price_id,
    plan_tier: data.plan_tier ?? null,
    billing_interval: data.billing_interval ?? null,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}
