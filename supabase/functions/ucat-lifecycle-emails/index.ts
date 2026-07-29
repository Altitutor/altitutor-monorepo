import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildLifecycleEmail } from "./email.ts";
import { chooseLifecycleCampaign, type LifecycleCandidate } from "./logic.ts";

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  const expectedSecret = Deno.env.get("UCAT_LIFECYCLE_CRON_SECRET_KEY")?.trim();
  const supplied = request.headers.get("authorization")?.replace(
    /^Bearer\s+/i,
    "",
  ).trim();
  if (!expectedSecret || supplied !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { mode?: unknown; now?: unknown; limit?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // Empty cron bodies use safe defaults.
  }
  const requestedSend = body.mode === "send";
  const enabled =
    Deno.env.get("UCAT_LIFECYCLE_EMAILS_ENABLED")?.toLowerCase() === "true";
  const send = requestedSend && enabled;
  const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 250);
  const now =
    typeof body.now === "string" && Deno.env.get("ENVIRONMENT") !== "production"
      ? new Date(body.now)
      : new Date();
  if (Number.isNaN(now.getTime())) {
    return json({ error: "Invalid now value" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Supabase not configured" }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("vinternal_ucat_lifecycle_email_candidates")
    .select("*")
    .limit(limit);
  if (error) {
    return json(
      { error: "Could not load candidates", detail: error.message },
      500,
    );
  }

  const candidates = (data ?? []) as LifecycleCandidate[];
  const eligible = candidates.flatMap((candidate) => {
    const campaign = chooseLifecycleCampaign(candidate, now);
    return campaign ? [{ candidate, campaign }] : [];
  });

  if (!send) {
    return json({
      mode: "dry_run",
      enabled,
      requestedSend,
      candidatesScanned: candidates.length,
      eligible: eligible.map(({ candidate, campaign }) => ({
        studentId: candidate.student_id,
        campaign: campaign.key,
        dedupeKey: campaign.dedupeKey,
      })),
    });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!resendApiKey) {
    return json({ error: "RESEND_API_KEY not configured" }, 500);
  }
  const results: Array<
    { studentId: string; campaign: string; status: string }
  > = [];

  for (const { candidate, campaign } of eligible) {
    const evidence = {
      questionsLast7Days: candidate.questions_last_7_days ?? 0,
      setsLast7Days: candidate.sets_last_7_days ?? 0,
      mocksLast7Days: candidate.mocks_last_7_days ?? 0,
      currentEstimate: candidate.current_estimate,
      lastActivityAt: candidate.last_activity_at,
    };
    const { data: claim, error: claimError } = await supabase.rpc(
      "claim_ucat_lifecycle_email",
      {
        p_student_id: candidate.student_id,
        p_recipient_email: candidate.email,
        p_campaign_key: campaign.key,
        p_topic: campaign.topic,
        p_dedupe_key: campaign.dedupeKey,
        p_evidence: evidence,
      },
    );
    const ledger = Array.isArray(claim) ? claim[0] : claim;
    if (claimError || !ledger?.id) {
      results.push({
        studentId: candidate.student_id,
        campaign: campaign.key,
        status: claimError ? "claim_failed" : "deduped",
      });
      continue;
    }

    const email = buildLifecycleEmail(candidate, campaign);
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `ucat-lifecycle/${campaign.dedupeKey}`,
        },
        body: JSON.stringify({
          from: email.from,
          reply_to: email.replyTo,
          to: candidate.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
          headers: {
            "List-Unsubscribe": `<${email.unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          tags: email.tags,
        }),
      });
      if (!response.ok) {
        throw new Error(`Resend ${response.status}: ${await response.text()}`);
      }
      const payload = await response.json() as { id?: string };
      await supabase.from("ucat_email_delivery_ledger").update({
        status: "sent",
        delivery_status: "accepted",
        sent_at: new Date().toISOString(),
        provider_message_id: payload.id ?? null,
        last_error: null,
      }).eq("id", ledger.id);
      results.push({
        studentId: candidate.student_id,
        campaign: campaign.key,
        status: "sent",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase.from("ucat_email_delivery_ledger").update({
        status: "failed",
        last_error: message.slice(0, 2000),
      }).eq("id", ledger.id);
      results.push({
        studentId: candidate.student_id,
        campaign: campaign.key,
        status: "failed",
      });
    }
  }

  return json({
    mode: "send",
    enabled,
    candidatesScanned: candidates.length,
    eligible: eligible.length,
    results,
  });
});
