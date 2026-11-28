import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createAppleVerifier,
  type AppleEnvironment,
} from "@/features/apple-subscription/apple-gateway";
import { reconcileAppleSubscription } from "@/features/apple-subscription/billing-service";
import {
  appleBillingConfigured,
  sandboxAccountAllowed,
} from "@/features/apple-subscription/apple-config";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!supabaseAdmin || !appleBillingConfigured())
    return NextResponse.json(
      { error: "Apple billing unavailable" },
      { status: 503 },
    );
  try {
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("signedPayload" in body) ||
      typeof body.signedPayload !== "string" ||
      body.signedPayload.length > 128000
    )
      return NextResponse.json(
        { error: "Invalid notification" },
        { status: 400 },
      );
    let verified:
      | {
          environment: AppleEnvironment;
          transactionId: string;
          accountToken: string;
        }
      | undefined;
    for (const environment of ["Production", "Sandbox"] as const) {
      const verifier = createAppleVerifier(environment);
      try {
        const notification = await verifier.verifyAndDecodeNotification(
          body.signedPayload,
        );
        if (notification.notificationType === "TEST")
          return NextResponse.json({ ok: true });
        if (!notification.data?.signedTransactionInfo)
          return NextResponse.json({ ok: true });
        const transaction = await verifier.verifyAndDecodeTransaction(
          notification.data.signedTransactionInfo,
        );
        if (!transaction.transactionId || !transaction.appAccountToken)
          return NextResponse.json(
            { error: "Purchase account missing" },
            { status: 400 },
          );
        verified = {
          environment,
          transactionId: transaction.transactionId,
          accountToken: transaction.appAccountToken,
        };
        break;
      } catch {
        /* Try the other Apple environment; neither is trusted before verification. */
      }
    }
    if (!verified)
      return NextResponse.json(
        { error: "Unable to verify notification" },
        { status: 503 },
      );
    const { data: owner, error } = await supabaseAdmin
      .from("ucat_apple_accounts")
      .select("student_id,students(user_id)")
      .eq("account_token", verified.accountToken)
      .maybeSingle();
    if (error) throw new Error("Binding lookup unavailable");
    if (!owner)
      return NextResponse.json(
        { error: "Purchase account unavailable" },
        { status: 503 },
      );
    const allowSandbox = Boolean(
      owner.students?.user_id && sandboxAccountAllowed(owner.students.user_id),
    );
    if (verified.environment === "Sandbox" && !allowSandbox)
      return NextResponse.json({ ok: true });
    await reconcileAppleSubscription(
      supabaseAdmin,
      verified.accountToken,
      verified.transactionId,
      verified.environment,
      allowSandbox,
    );
    return NextResponse.json({ ok: true });
  } catch {
    // Apple retries server failures. Never log signed payloads or account tokens.
    return NextResponse.json(
      { error: "Unable to process Apple notification" },
      { status: 503 },
    );
  }
}
