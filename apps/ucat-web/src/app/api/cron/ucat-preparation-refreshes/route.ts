import { NextRequest, NextResponse } from "next/server";
import { captureMessage } from "@sentry/nextjs";
import { processPendingPreparationRefreshes } from "@/features/preparation/server/preparation-refresh-worker";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const maxDuration = 300;

function workerConcurrency() {
  const configured = Number.parseInt(
    process.env.UCAT_PREPARATION_WORKER_CONCURRENCY ?? "3",
    10,
  );
  return Number.isFinite(configured) ? Math.max(1, Math.min(configured, 8)) : 3;
}

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
  type RpcResult<T> = Promise<{
    data: T | null;
    error: { message: string } | null;
  }>;
  const queueClient = supabaseAdmin as unknown as {
    rpc: {
      (
        name: "enqueue_due_ucat_study_plan_rebalances",
        params: { p_limit: number },
      ): RpcResult<number>;
      (
        name: "list_ucat_study_plan_maintenance_anomalies",
        params: { p_limit: number },
      ): RpcResult<Array<{ student_id: string; anomaly: string }>>;
      (
        name: "rollover_due_ucat_study_plan_tasks",
        params: { p_limit: number },
      ): RpcResult<
        Array<{ students_processed: number; tasks_skipped: number }>
      >;
    };
  };
  const rollover = await queueClient.rpc("rollover_due_ucat_study_plan_tasks", {
    p_limit: 200,
  });
  if (rollover.error) {
    return NextResponse.json(
      { error: rollover.error.message },
      { status: 500 },
    );
  }
  const [due, anomalies] = await Promise.all([
    queueClient.rpc("enqueue_due_ucat_study_plan_rebalances", { p_limit: 50 }),
    queueClient.rpc("list_ucat_study_plan_maintenance_anomalies", {
      p_limit: 20,
    }),
  ]);
  if (due.error) {
    return NextResponse.json({ error: due.error.message }, { status: 500 });
  }
  if (anomalies.error) {
    return NextResponse.json(
      { error: anomalies.error.message },
      { status: 500 },
    );
  }
  if (anomalies.data?.length) {
    captureMessage("UCAT Study-plan maintenance data-integrity anomalies", {
      level: "error",
      tags: { subsystem: "ucat_study_plan_maintenance" },
      extra: { anomalies: anomalies.data },
    });
  }

  const deadline = Date.now() + 240_000;
  const result = { claimed: 0, completed: 0, failed: 0 };
  const concurrency = workerConcurrency();
  while (result.claimed < 50 && Date.now() < deadline) {
    const batchSize = Math.min(concurrency, 50 - result.claimed);
    // Each lane claims only the job it is about to execute. This preserves the
    // short lease while allowing bounded parallelism for independent Students.
    const batch = await Promise.all(
      Array.from({ length: batchSize }, () =>
        processPendingPreparationRefreshes({ limit: 1 }),
      ),
    );
    const batchClaimed = batch.reduce((sum, next) => sum + next.claimed, 0);
    for (const next of batch) {
      result.claimed += next.claimed;
      result.completed += next.completed;
      result.failed += next.failed;
    }
    if (batchClaimed < batchSize) break;
  }
  return NextResponse.json({
    rollover: rollover.data?.[0] ?? {
      students_processed: 0,
      tasks_skipped: 0,
    },
    scheduled: due.data ?? 0,
    ...result,
  });
}
