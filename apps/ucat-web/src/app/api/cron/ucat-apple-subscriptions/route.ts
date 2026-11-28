import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appleBillingConfigured } from "@/features/apple-subscription/apple-config";
import { reconcileAppleSubscription } from "@/features/apple-subscription/billing-service";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Backstop for delayed server notifications; never manufactures access locally. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!appleBillingConfigured()) return NextResponse.json({ enabled: false });
  if (!supabaseAdmin)
    return NextResponse.json({ error: "Billing unavailable" }, { status: 503 });
  const { data, error } = await supabaseAdmin
    .from("ucat_apple_subscriptions")
    .select("environment,original_transaction_id,account_token")
    .eq("environment", "Production")
    .in("status", [1, 3, 4])
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(50);
  if (error)
    return NextResponse.json({ error: "Billing unavailable" }, { status: 503 });
  let checked = 0,
    failed = 0;
  for (const row of data ?? []) {
    try {
      // Rotate attempts independently of verified state, so a broken purchase
      // cannot starve every later subscription out of this bounded batch.
      const attempt = await supabaseAdmin
        .from("ucat_apple_subscriptions")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("environment", row.environment)
        .eq("original_transaction_id", row.original_transaction_id);
      if (attempt.error)
        throw new Error("Unable to record reconciliation attempt");
      await reconcileAppleSubscription(
        supabaseAdmin,
        row.account_token,
        row.original_transaction_id,
        "Production",
        false,
      );
      checked++;
    } catch {
      failed++;
    }
  }
  return NextResponse.json({ checked, failed }, { status: failed ? 503 : 200 });
}
