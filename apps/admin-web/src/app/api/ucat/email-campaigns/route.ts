import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminStaff } from "@/features/pay-tiers/server/requireAdminStaff";

function operationalClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  return url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
}

async function authorizedClient() {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth;
  const client = operationalClient();
  if (!client) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      ),
    };
  }
  return { ok: true as const, client, staffId: auth.staffId };
}

export async function GET() {
  const auth = await authorizedClient();
  if (!auth.ok) return auth.response;

  const [settings, metrics, runs, failures, assignments, windows] =
    await Promise.all([
      auth.client
        .from("ucat_email_program_settings")
        .select("*")
        .eq("singleton", true)
        .single(),
      auth.client
        .from("vinternal_ucat_email_campaign_metrics")
        .select("*")
        .order("priority", { ascending: false }),
      auth.client
        .from("ucat_email_program_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(12),
      auth.client
        .from("ucat_email_delivery_ledger")
        .select("id,campaign_key,status,last_error,updated_at")
        .in("status", ["failed", "suppressed"])
        .order("updated_at", { ascending: false })
        .limit(20),
      auth.client.from("ucat_email_program_assignments").select("cohort"),
      auth.client
        .from("ucat_email_broadcast_windows")
        .select("*")
        .order("starts_at", { ascending: false })
        .limit(20),
    ]);
  const error = [settings, metrics, runs, failures, assignments, windows].find(
    (result) => result.error,
  )?.error;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const cohortCounts = (assignments.data ?? []).reduce<Record<string, number>>(
    (counts, row) => {
      counts[row.cohort] = (counts[row.cohort] ?? 0) + 1;
      return counts;
    },
    {},
  );
  return NextResponse.json({
    settings: settings.data,
    campaigns: metrics.data ?? [],
    runs: runs.data ?? [],
    failures: failures.data ?? [],
    broadcastWindows: windows.data ?? [],
    cohortCounts,
    links: {
      posthog:
        process.env.NEXT_PUBLIC_POSTHOG_UCAT_EMAIL_DASHBOARD_URL ||
        "https://us.posthog.com",
      resend:
        process.env.NEXT_PUBLIC_RESEND_BROADCASTS_URL ||
        "https://resend.com/broadcasts",
    },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizedClient();
  if (!auth.ok) return auth.response;
  const body = (await request.json()) as {
    paused?: unknown;
    campaignKey?: unknown;
    enabled?: unknown;
  };

  if (typeof body.paused === "boolean") {
    const { error } = await auth.client
      .from("ucat_email_program_settings")
      .update({
        paused: body.paused,
        updated_by_staff_id: auth.staffId,
      })
      .eq("singleton", true);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (
    typeof body.campaignKey === "string" &&
    typeof body.enabled === "boolean"
  ) {
    const { error } = await auth.client
      .from("ucat_email_campaign_controls")
      .update({
        enabled: body.enabled,
        updated_by_staff_id: auth.staffId,
      })
      .eq("campaign_key", body.campaignKey);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Invalid update" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const auth = await authorizedClient();
  if (!auth.ok) return auth.response;
  const body = (await request.json()) as {
    action?: unknown;
    label?: unknown;
    startsAt?: unknown;
    endsAt?: unknown;
    windowId?: unknown;
  };

  if (body.action === "dry_run") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.UCAT_LIFECYCLE_CRON_SECRET_KEY;
    if (!url || !secret) {
      return NextResponse.json(
        { error: "Lifecycle function is not configured" },
        { status: 500 },
      );
    }
    const result = await fetch(url + "/functions/v1/ucat-lifecycle-emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + secret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "dry_run", limit: 100 }),
      cache: "no-store",
    });
    const payload = await result.json();
    return NextResponse.json(payload, { status: result.status });
  }

  if (
    body.action === "schedule_broadcast" &&
    typeof body.label === "string" &&
    typeof body.startsAt === "string" &&
    typeof body.endsAt === "string"
  ) {
    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (
      !body.label.trim() ||
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      return NextResponse.json(
        { error: "Invalid broadcast window" },
        { status: 400 },
      );
    }
    const { error } = await auth.client
      .from("ucat_email_broadcast_windows")
      .insert({
        label: body.label.trim(),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        created_by_staff_id: auth.staffId,
      });
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete_broadcast" && typeof body.windowId === "string") {
    const { error } = await auth.client
      .from("ucat_email_broadcast_windows")
      .delete()
      .eq("id", body.windowId);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
