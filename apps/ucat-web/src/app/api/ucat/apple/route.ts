import { NextRequest, NextResponse } from "next/server";
import {
  appleBillingContext,
  appleBillingState,
  AppleBillingError,
  syncApplePurchase,
} from "@/features/apple-subscription/billing-service";

export const runtime = "nodejs";
function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof AppleBillingError
          ? error.message
          : "Apple purchase could not be verified. Please try Restore purchases.",
    },
    { status: error instanceof AppleBillingError ? error.status : 400 },
  );
}
export async function GET() {
  try {
    return NextResponse.json(
      await appleBillingState(await appleBillingContext()),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const context = await appleBillingContext();
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("transactionId" in body) ||
      typeof body.transactionId !== "string" ||
      !/^\d{1,100}$/.test(body.transactionId) ||
      !("environment" in body) ||
      (body.environment !== "Production" && body.environment !== "Sandbox")
    ) {
      throw new AppleBillingError("Invalid purchase.", 400);
    }
    return NextResponse.json(
      await syncApplePurchase(context, body.transactionId, body.environment),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
