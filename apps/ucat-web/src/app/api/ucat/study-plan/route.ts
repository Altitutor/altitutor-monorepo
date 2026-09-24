import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getStudyPlan,
  saveStudyPlanProfile,
} from "@/features/study-plan/server/study-plan-service";
import { parseStudyPlanProfileInput } from "@/features/study-plan/lib/validation";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

async function authenticatedClient() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw new Error("Failed to get user.");
  return { supabase, user };
}

export async function GET(_request: NextRequest) {
  try {
    const { supabase, user } = await authenticatedClient();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(
      await getStudyPlan(supabase, user.id, {
        allowAutomaticReplan: false,
        reconcileTasks: false,
        refreshGuidance: false,
      }),
    );
  } catch (error) {
    const message = errorMessage(error, "Failed to load Study plan.");
    // Incomplete signup (auth user, no students row) — not a server fault.
    if (message.toLowerCase().includes("no student profile")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    captureApiError(error, "/api/ucat/study-plan");
    console.error("[study-plan] GET failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { supabase, user } = await authenticatedClient();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const input = parseStudyPlanProfileInput(await request.json());
    return NextResponse.json(
      await saveStudyPlanProfile(supabase, user.id, input),
    );
  } catch (error) {
    captureApiError(error, "/api/ucat/study-plan");
    console.error("[study-plan] PUT failed", error);
    const message = errorMessage(error, "Failed to save Study plan.");
    const isValidation =
      !message.toLowerCase().includes("failed") &&
      !message.toLowerCase().includes("configured");
    return NextResponse.json(
      { error: message },
      { status: isValidation ? 400 : 500 },
    );
  }
}
