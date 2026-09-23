import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { loadFutureInvoicePreviews } from "@/features/billing/server/future-invoices";
import { getServerSupabaseAdmin } from "@/shared/lib/supabase/server";
import { createClient } from "@/shared/lib/supabase/server-ssr";

export const dynamic = "force-dynamic";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const userClient = createClient();
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: PRIVATE_NO_STORE },
      );
    }

    const [studentCheck, studentIdResult] = await Promise.all([
      userClient.rpc("is_student"),
      userClient.rpc("current_student_id"),
    ]);

    if (studentCheck.error || studentIdResult.error) {
      throw studentCheck.error || studentIdResult.error;
    }

    if (!studentCheck.data || !studentIdResult.data) {
      return NextResponse.json(
        { error: "Student access required" },
        { status: 403, headers: PRIVATE_NO_STORE },
      );
    }

    const futureInvoices = await loadFutureInvoicePreviews(
      getServerSupabaseAdmin(),
      studentIdResult.data,
    );

    return NextResponse.json(
      { future_invoices: futureInvoices },
      { headers: PRIVATE_NO_STORE },
    );
  } catch (error: unknown) {
    captureApiError(error, "/api/billing/future-invoices");
    console.error("[api/billing/future-invoices] Error:", error);
    return NextResponse.json(
      { error: "Failed to load future invoices" },
      { status: 500, headers: PRIVATE_NO_STORE },
    );
  }
}
