import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  renderTransactionalEmail,
  type TransactionalEmailRow,
} from "./email.ts";

const MAX_ATTEMPTS = 5;

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(
    0,
    2000,
  );
}

function nextAttemptAt(attemptCount: number): string {
  const seconds = Math.min(60 * (2 ** Math.max(attemptCount - 1, 0)), 3600);
  return new Date(Date.now() + seconds * 1000).toISOString();
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const expectedSecret = Deno.env.get("UCAT_EMAIL_DISPATCH_SECRET_KEY")?.trim();
  const suppliedSecret = request.headers.get("authorization")
    ?.replace(/^Bearer\s+/i, "").trim();
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { limit?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // An empty cron body uses the default batch size.
  }
  const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 100);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return json({ error: "Email dispatcher is not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.rpc(
    "claim_ucat_transactional_emails",
    { p_limit: limit },
  );
  if (error) {
    return json(
      { error: "Could not claim email jobs", detail: error.message },
      500,
    );
  }

  const rows = (data ?? []) as TransactionalEmailRow[];
  const results: Array<{
    id: string;
    template: string;
    status: "sent" | "suppressed" | "failed";
  }> = [];

  for (const row of rows) {
    try {
      const { data: suppression, error: suppressionError } = await supabase
        .from("ucat_email_suppressions")
        .select("reason")
        .eq("email", row.recipient_email)
        .eq("active", true)
        .maybeSingle();
      if (suppressionError) throw suppressionError;

      if (suppression) {
        const { error: updateError } = await supabase
          .from("ucat_transactional_email_outbox")
          .update({
            status: "suppressed",
            delivery_status: "suppressed",
            claimed_at: null,
            last_error: `Suppressed after ${String(suppression.reason)}`.slice(
              0,
              2000,
            ),
          })
          .eq("id", row.id);
        if (updateError) throw updateError;
        results.push({
          id: row.id,
          template: row.template_key,
          status: "suppressed",
        });
        continue;
      }

      const email = renderTransactionalEmail(row);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `ucat-transactional/${row.event_key}`.slice(
            0,
            256,
          ),
        },
        body: JSON.stringify({
          from: email.from,
          reply_to: email.replyTo,
          to: row.recipient_email,
          subject: email.subject,
          html: email.html,
          text: email.text,
          tags: email.tags,
        }),
      });
      if (!response.ok) {
        throw new Error(`Resend ${response.status}: ${await response.text()}`);
      }
      const responseBody = await response.json() as { id?: string };
      if (!responseBody.id) {
        throw new Error("Resend did not return a message id");
      }

      const { error: updateError } = await supabase
        .from("ucat_transactional_email_outbox")
        .update({
          status: "sent",
          delivery_status: "accepted",
          provider_message_id: responseBody.id,
          sent_at: new Date().toISOString(),
          claimed_at: null,
          last_error: null,
        })
        .eq("id", row.id);
      if (updateError) throw updateError;
      results.push({
        id: row.id,
        template: row.template_key,
        status: "sent",
      });
    } catch (error) {
      const exhausted = row.attempt_count >= MAX_ATTEMPTS;
      await supabase
        .from("ucat_transactional_email_outbox")
        .update({
          status: "failed",
          delivery_status: exhausted ? "failed" : null,
          next_attempt_at: nextAttemptAt(row.attempt_count),
          claimed_at: null,
          last_error: errorMessage(error),
        })
        .eq("id", row.id);
      results.push({
        id: row.id,
        template: row.template_key,
        status: "failed",
      });
    }
  }

  return json({
    claimed: rows.length,
    sent: results.filter((result) => result.status === "sent").length,
    suppressed: results.filter((result) => result.status === "suppressed")
      .length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  });
});
