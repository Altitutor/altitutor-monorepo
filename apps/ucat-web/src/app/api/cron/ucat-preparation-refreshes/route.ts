import { NextRequest, NextResponse } from "next/server";
import { processPendingPreparationRefreshes } from "@/features/preparation/server/preparation-refresh-worker";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (
    process.env.NODE_ENV === "production" &&
    (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase admin client is unavailable." },
      { status: 500 },
    );
  }
  const queueClient = supabaseAdmin as unknown as {
    rpc: (
      name: "enqueue_due_ucat_study_plan_rebalances",
      params: { p_limit: number },
    ) => Promise<{ data: number | null; error: { message: string } | null }>;
  };
  const due = await queueClient.rpc("enqueue_due_ucat_study_plan_rebalances", {
    p_limit: 50,
  });
  if (due.error) {
    return NextResponse.json({ error: due.error.message }, { status: 500 });
  }

  const deadline = Date.now() + 240_000;
  const result = { claimed: 0, completed: 0, failed: 0 };
  while (result.claimed < 50 && Date.now() < deadline) {
    // Claim only work this invocation is about to execute. A large upfront
    // lease could dead-letter jobs that never ran when the cron times out.
    const next = await processPendingPreparationRefreshes({ limit: 1 });
    result.claimed += next.claimed;
    result.completed += next.completed;
    result.failed += next.failed;
    if (next.claimed === 0) break;
  }
  return NextResponse.json({ scheduled: due.data ?? 0, ...result });
}
