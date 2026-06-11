import { NextRequest, NextResponse } from "next/server";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import { getLeaderboard } from "@/lib/ucat/skill-trainer/attempt-service";
import { resolveTrainerKeyParam } from "@/lib/ucat/skill-trainer/resolve-trainer-key";

export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } },
) {
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  const windowParam = request.nextUrl.searchParams.get("window");
  const window =
    windowParam === "all_time"
      ? "all_time"
      : windowParam === "my_scores"
        ? "my_scores"
        : "week";

  const trainerKey = resolveTrainerKeyParam(params.key);
  if (!trainerKey) {
    return NextResponse.json({ error: "Trainer not found" }, { status: 404 });
  }

  try {
    const entries = await getLeaderboard(
      auth.admin,
      trainerKey,
      window,
      auth.timezone,
      auth.studentId,
    );
    return NextResponse.json({ entries, window });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load leaderboard" },
      { status: 500 },
    );
  }
}
