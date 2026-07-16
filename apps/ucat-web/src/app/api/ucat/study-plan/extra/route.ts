import { NextRequest, NextResponse } from "next/server";
import { parseExtraStudyInput } from "@/features/study-plan/lib/validation";
import {
  createExtraStudyTask,
  ExtraStudyUnavailableError,
} from "@/features/study-plan/server/study-plan-service";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Failed to add extra study.";
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const input = parseExtraStudyInput(await request.json());
    return NextResponse.json(
      await createExtraStudyTask(supabase, user.id, input),
    );
  } catch (error) {
    console.error("[study-plan] extra study POST failed", error);
    const status =
      error instanceof ExtraStudyUnavailableError
        ? 409
        : error instanceof Error &&
            (error.message.startsWith("Choose ") ||
              error.message.startsWith("Extra study time"))
          ? 400
          : 500;
    return NextResponse.json({ error: errorMessage(error) }, { status });
  }
}
