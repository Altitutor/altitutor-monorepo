import { NextRequest, NextResponse } from "next/server";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import { getLeaderboard } from "@/lib/ucat/skill-trainer/attempt-service";

export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } },
) {
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  const window = request.nextUrl.searchParams.get("window") === "all_time" ? "all_time" : "week";

  try {
    const entries = await getLeaderboard(
      auth.admin,
      params.key,
      window,
      auth.timezone,
    );
    return NextResponse.json({ entries, window });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load leaderboard" },
      { status: 500 },
    );
  }
}
