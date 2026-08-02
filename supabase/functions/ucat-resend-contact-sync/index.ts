import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Resend } from "npm:resend@6.9.1";

type TopicKey =
  | "weekly_progress_and_guidance"
  | "lessons_and_tips"
  | "product_news"
  | "offers_and_referrals";

const TOPIC_ENV: Record<TopicKey, string> = {
  weekly_progress_and_guidance: "RESEND_TOPIC_WEEKLY_PROGRESS_ID",
  lessons_and_tips: "RESEND_TOPIC_LESSONS_ID",
  product_news: "RESEND_TOPIC_PRODUCT_NEWS_ID",
  offers_and_referrals: "RESEND_TOPIC_OFFERS_ID",
};

function response(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return response({ error: "Method not allowed" }, 405);
  }
  const expected = Deno.env.get("UCAT_LIFECYCLE_CRON_SECRET_KEY")?.trim();
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!expected || supplied !== expected) {
    return response({ error: "Unauthorized" }, 401);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const topics = Object.fromEntries(
    Object.entries(TOPIC_ENV).map(([key, env]) => [
      key,
      Deno.env.get(env)?.trim(),
    ]),
  ) as Record<TopicKey, string | undefined>;
  const missing = Object.entries(topics)
    .filter(([, id]) => !id)
    .map(([key]) => key);
  if (!apiKey || !supabaseUrl || !serviceKey || missing.length > 0) {
    return response(
      {
        error: "Contact sync is not configured",
        missingTopics: missing,
      },
      500,
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const resend = new Resend(apiKey);
  const { data: subscribers, error: subscriberError } = await supabase
    .from("newsletter_subscribers")
    .select(
      "id,email,student_id,unsubscribed_at,students(first_name,last_name)",
    )
    .is("resend_audience_synced_at", null)
    .order("updated_at", { ascending: true })
    .limit(100);
  if (subscriberError) {
    return response({ error: subscriberError.message }, 500);
  }

  const studentIds = (subscribers ?? [])
    .map((row) => row.student_id)
    .filter((id): id is string => Boolean(id));
  const preferenceMap = new Map<string, Record<TopicKey, boolean>>();
  if (studentIds.length > 0) {
    const { data: preferences, error } = await supabase
      .from("ucat_communication_preferences")
      .select(
        "student_id,weekly_progress_and_guidance,lessons_and_tips,product_news,offers_and_referrals",
      )
      .in("student_id", studentIds);
    if (error) return response({ error: error.message }, 500);
    for (const preference of preferences ?? []) {
      preferenceMap.set(
        preference.student_id,
        preference as Record<TopicKey, boolean>,
      );
    }
  }

  let synced = 0;
  const failures: Array<{ subscriberId: string; message: string }> = [];
  for (const subscriber of subscribers ?? []) {
    const student = Array.isArray(subscriber.students)
      ? subscriber.students[0]
      : subscriber.students;
    const preferences = subscriber.student_id
      ? preferenceMap.get(subscriber.student_id)
      : undefined;
    const unsubscribed =
      Boolean(subscriber.unsubscribed_at) ||
      !preferences ||
      !Object.keys(TOPIC_ENV).some((key) => preferences[key as TopicKey]);
    const topicUpdates = Object.keys(TOPIC_ENV).map((key) => ({
      id: topics[key as TopicKey] as string,
      subscription:
        preferences?.[key as TopicKey] && !unsubscribed
          ? ("opt_in" as const)
          : ("opt_out" as const),
    }));

    try {
      const existing = await resend.contacts.get({ email: subscriber.email });
      if (existing.error) {
        const created = await resend.contacts.create({
          email: subscriber.email,
          firstName: student?.first_name || undefined,
          lastName: student?.last_name || undefined,
          unsubscribed,
          topics: topicUpdates,
        });
        if (created.error) throw new Error(created.error.message);
      } else {
        const updated = await resend.contacts.update({
          email: subscriber.email,
          unsubscribed,
        });
        if (updated.error) throw new Error(updated.error.message);
        const topicResult = await resend.contacts.topics.update({
          email: subscriber.email,
          topics: topicUpdates,
        });
        if (topicResult.error) throw new Error(topicResult.error.message);
      }
      const { error } = await supabase
        .from("newsletter_subscribers")
        .update({
          resend_audience_synced_at: new Date().toISOString(),
        })
        .eq("id", subscriber.id);
      if (error) throw new Error(error.message);
      synced += 1;
    } catch (error) {
      failures.push({
        subscriberId: subscriber.id,
        message: (error instanceof Error ? error.message : String(error)).slice(
          0,
          500,
        ),
      });
    }
  }

  return response(
    {
      scanned: subscribers?.length ?? 0,
      synced,
      failed: failures.length,
      failures,
    },
    failures.length > 0 && synced === 0 ? 500 : 200,
  );
});
