import { NextRequest, NextResponse } from "next/server";
import { UCAT_APPLE_PRODUCTS } from "@altitutor/shared";
import {
  appleBillingContext,
  AppleBillingError,
} from "@/features/apple-subscription/billing-service";
import { appleBillingConfigured } from "@/features/apple-subscription/apple-config";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const context = await appleBillingContext();
    if (!appleBillingConfigured())
      throw new AppleBillingError("Apple billing is not available yet.", 503);
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("productId" in body) ||
      typeof body.productId !== "string" ||
      !UCAT_APPLE_PRODUCTS.some((p) => p.id === body.productId)
    )
      throw new AppleBillingError("Unknown subscription.", 400);
    const { data, error } = await context.admin.rpc(
      "prepare_ucat_apple_purchase",
      { p_student_id: context.student.id, p_product_id: body.productId },
    );
    if (error || !data)
      throw new AppleBillingError(
        "Unable to start another subscription. Finish or cancel any open checkout, and check your existing subscription first.",
        409,
      );
    return NextResponse.json(
      { accountToken: data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof AppleBillingError
            ? error.message
            : "Unable to prepare purchase.",
      },
      { status: error instanceof AppleBillingError ? error.status : 503 },
    );
  }
}
export async function DELETE() {
  try {
    const context = await appleBillingContext();
    const { error } = await context.admin.rpc("release_ucat_apple_checkout", {
      p_student_id: context.student.id,
    });
    if (error) throw new AppleBillingError("Unable to clear checkout.", 503);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof AppleBillingError
            ? error.message
            : "Unable to clear checkout.",
      },
      { status: error instanceof AppleBillingError ? error.status : 503 },
    );
  }
}
