import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildLifecycleEmail, buildLifecyclePreview } from "./email.ts";
import {
  chooseLifecycleCampaign,
  type CampaignControl,
  type LifecycleCampaign,
  type LifecycleCampaignKey,
  type LifecycleCandidate,
  type UcatFamiliarity,
} from "./logic.ts";

const PAGE_SIZE = 250;
const MAX_SCAN = 5_000;
const CAMPAIGN_KEYS: LifecycleCampaignKey[] = [
  "onboarding_starting_point",
  "onboarding_technique",
  "onboarding_timing",
  "onboarding_plan",
  "first_score_estimate",
  "weekly_review",
  "gentle_restart",
  "upgrade_quota",
  "upgrade_consistency",
  "referral_invitation",
];

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isCampaignKey(value: unknown): value is LifecycleCampaignKey {
  return (
    typeof value === "string" &&
    CAMPAIGN_KEYS.includes(value as LifecycleCampaignKey)
  );
}

function isFamiliarity(value: unknown): value is UcatFamiliarity {
  return value === "new" || value === "familiar" || value === "experienced";
}

async function syncPosthogCohorts(
  supabase: {
    from: (relation: string) => {
      update: (values: Record<string, unknown>) => {
        in: (column: string, values: string[]) => PromiseLike<unknown>;
      };
    };
  },
  candidates: LifecycleCandidate[],
) {
  const token = Deno.env.get("POSTHOG_PROJECT_TOKEN")?.trim();
  const pending = candidates.filter(
    (candidate) =>
      candidate.email_program_cohort &&
      candidate.email_program_bucket != null &&
      !candidate.email_program_posthog_synced_at,
  );
  if (!token || pending.length === 0) return;

  const configuredHost =
    Deno.env.get("POSTHOG_HOST") || "https://us.i.posthog.com";
  let endpoint: URL;
  try {
    endpoint = new URL("/batch/", configuredHost);
    if (endpoint.protocol !== "https:") return;
  } catch {
    return;
  }
  const result = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: token,
      batch: pending.map((candidate) => ({
        event: "$identify",
        properties: {
          distinct_id: candidate.auth_user_id,
          $set: {
            ucat_email_program_cohort: candidate.email_program_cohort,
            ucat_email_program_bucket: candidate.email_program_bucket,
          },
        },
      })),
    }),
  });
  if (!result.ok) return;
  await supabase
    .from("ucat_email_program_assignments")
    .update({ posthog_synced_at: new Date().toISOString() })
    .in(
      "student_id",
      pending.map((candidate) => candidate.student_id),
    );
}

Deno.serve(async (request) => {
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);

  const expectedSecret = Deno.env.get("UCAT_LIFECYCLE_CRON_SECRET_KEY")?.trim();
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!expectedSecret || supplied !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: {
    mode?: unknown;
    now?: unknown;
    limit?: unknown;
    campaign?: unknown;
    familiarity?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    // Scheduled invocations may use an empty body.
  }

  if (body.mode === "preview") {
    if (!isCampaignKey(body.campaign)) {
      return json({ error: "Invalid campaign" }, 400);
    }
    const familiarity = isFamiliarity(body.familiarity)
      ? body.familiarity
      : "new";
    const email = buildLifecyclePreview(body.campaign, familiarity);
    return new Response(email.html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const requestedSend = body.mode === "send";
  const enabled =
    Deno.env.get("UCAT_LIFECYCLE_EMAILS_ENABLED")?.toLowerCase() === "true";
  const send = requestedSend && enabled;
  const mode = send ? "send" : "dry_run";
  const sendLimit = Math.min(Math.max(Number(body.limit) || 100, 1), 250);
  const now =
    typeof body.now === "string" && Deno.env.get("ENVIRONMENT") !== "production"
      ? new Date(body.now)
      : new Date();
  if (Number.isNaN(now.getTime()))
    return json({ error: "Invalid now value" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Supabase not configured" }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const [
    { data: settings, error: settingsError },
    { data: controlRows, error: controlsError },
  ] = await Promise.all([
    supabase
      .from("ucat_email_program_settings")
      .select("*")
      .eq("singleton", true)
      .single(),
    supabase
      .from("ucat_email_campaign_controls")
      .select("campaign_key,enabled,priority,cooldown_days,topic"),
  ]);
  if (settingsError || controlsError) {
    return json(
      {
        error: "Could not load campaign controls",
        detail: settingsError?.message || controlsError?.message,
      },
      500,
    );
  }

  const { data: run, error: runError } = await supabase
    .from("ucat_email_program_runs")
    .insert({ mode, status: "running" })
    .select("id")
    .single();
  if (runError || !run?.id) {
    return json(
      { error: "Could not start program run", detail: runError?.message },
      500,
    );
  }

  const finish = async (
    status: "completed" | "failed" | "paused",
    values: Record<string, unknown>,
  ) => {
    await supabase
      .from("ucat_email_program_runs")
      .update({
        status,
        completed_at: new Date().toISOString(),
        ...values,
      })
      .eq("id", run.id);
  };

  const broadcastSuppressed =
    settings.broadcast_suppression_starts_at &&
    settings.broadcast_suppression_ends_at &&
    Date.parse(settings.broadcast_suppression_starts_at) <= now.getTime() &&
    Date.parse(settings.broadcast_suppression_ends_at) > now.getTime();
  const { count: activeWindowCount, error: windowError } = await supabase
    .from("ucat_email_broadcast_windows")
    .select("id", { count: "exact", head: true })
    .lte("starts_at", now.toISOString())
    .gt("ends_at", now.toISOString());
  if (windowError) {
    await finish("failed", { last_error: windowError.message });
    return json({ error: "Could not check product-news windows" }, 500);
  }
  if (settings.paused || broadcastSuppressed || (activeWindowCount ?? 0) > 0) {
    const reason = settings.paused ? "global_pause" : "product_news_window";
    await finish("paused", { result_summary: { reason } });
    return json({ mode, status: "paused", reason });
  }

  const controls = new Map<string, CampaignControl>(
    ((controlRows ?? []) as CampaignControl[]).map((control) => [
      control.campaign_key,
      control,
    ]),
  );
  const eligible: Array<{
    candidate: LifecycleCandidate;
    campaign: LifecycleCampaign;
  }> = [];
  let scanned = 0;
  let cursor: string | null = null;

  while (scanned < MAX_SCAN && eligible.length < sendLimit) {
    let query = supabase
      .from("vinternal_ucat_lifecycle_email_candidates")
      .select("*")
      .order("student_id", { ascending: true })
      .limit(PAGE_SIZE);
    if (cursor) query = query.gt("student_id", cursor);
    const { data, error } = await query;
    if (error) {
      await finish("failed", {
        scanned_count: scanned,
        eligible_count: eligible.length,
        last_error: error.message,
      });
      return json(
        { error: "Could not load candidates", detail: error.message },
        500,
      );
    }
    const page = (data ?? []) as LifecycleCandidate[];
    await syncPosthogCohorts(
      supabase as unknown as Parameters<typeof syncPosthogCohorts>[0],
      page,
    );
    for (const candidate of page) {
      scanned += 1;
      const selected = chooseLifecycleCampaign(candidate, now, controls);
      if (selected) eligible.push({ candidate, campaign: selected });
      if (eligible.length >= sendLimit || scanned >= MAX_SCAN) break;
    }
    if (page.length < PAGE_SIZE) break;
    cursor = page[page.length - 1]?.student_id ?? null;
    if (!cursor) break;
  }

  if (!send) {
    const samples = eligible.slice(0, 50).map(({ candidate, campaign }) => ({
      studentId: candidate.student_id,
      campaign: campaign.key,
      dedupeKey: campaign.dedupeKey,
    }));
    await finish("completed", {
      scanned_count: scanned,
      eligible_count: eligible.length,
      skipped_count: eligible.length,
      result_summary: {
        enabled,
        requested_send: requestedSend,
        scan_capped: scanned >= MAX_SCAN,
        samples,
      },
    });
    return json({
      mode: "dry_run",
      enabled,
      requestedSend,
      candidatesScanned: scanned,
      eligibleCount: eligible.length,
      samples,
    });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!resendApiKey) {
    await finish("failed", {
      scanned_count: scanned,
      eligible_count: eligible.length,
      last_error: "RESEND_API_KEY not configured",
    });
    return json({ error: "RESEND_API_KEY not configured" }, 500);
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const byCampaign: Record<
    string,
    { sent: number; skipped: number; failed: number }
  > = {};
  for (const { candidate, campaign } of eligible) {
    byCampaign[campaign.key] ||= { sent: 0, skipped: 0, failed: 0 };
    const { data: claim, error: claimError } = await supabase.rpc(
      "claim_ucat_lifecycle_email",
      {
        p_student_id: candidate.student_id,
        p_recipient_email: candidate.email,
        p_campaign_key: campaign.key,
        p_topic: campaign.topic,
        p_dedupe_key: campaign.dedupeKey,
        p_evidence: campaign.evidence,
      },
    );
    const ledger = Array.isArray(claim) ? claim[0] : claim;
    if (claimError || !ledger?.id) {
      skipped += 1;
      byCampaign[campaign.key].skipped += 1;
      continue;
    }

    const email = buildLifecycleEmail(candidate, campaign);
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + resendApiKey,
          "Content-Type": "application/json",
          "Idempotency-Key": "ucat-lifecycle/" + campaign.dedupeKey,
        },
        body: JSON.stringify({
          from: email.from,
          reply_to: email.replyTo,
          to: candidate.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
          headers: {
            "List-Unsubscribe": "<" + email.unsubscribeUrl + ">",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          tags: email.tags,
        }),
      });
      if (!response.ok) {
        throw new Error(
          "Resend " + response.status + ": " + (await response.text()),
        );
      }
      const payload = (await response.json()) as { id?: string };
      await supabase
        .from("ucat_email_delivery_ledger")
        .update({
          status: "sent",
          delivery_status: "accepted",
          sent_at: new Date().toISOString(),
          provider_message_id: payload.id ?? null,
          last_error: null,
        })
        .eq("id", ledger.id);
      sent += 1;
      byCampaign[campaign.key].sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase
        .from("ucat_email_delivery_ledger")
        .update({
          status: "failed",
          last_error: message.slice(0, 2_000),
        })
        .eq("id", ledger.id);
      failed += 1;
      byCampaign[campaign.key].failed += 1;
    }
  }

  await finish("completed", {
    scanned_count: scanned,
    eligible_count: eligible.length,
    sent_count: sent,
    skipped_count: skipped,
    failed_count: failed,
    result_summary: {
      by_campaign: byCampaign,
      scan_capped: scanned >= MAX_SCAN,
    },
  });
  return json({
    mode: "send",
    candidatesScanned: scanned,
    eligibleCount: eligible.length,
    sent,
    skipped,
    failed,
    byCampaign,
  });
});
