"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  Mail,
  PauseCircle,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import { SettingsPageHeader } from "@/shared/components";

type Campaign = {
  campaign_key: string;
  display_name: string;
  topic: string;
  enabled: boolean;
  priority: number;
  cooldown_days: number;
  attempts_last_30_days: number;
  sent_last_30_days: number;
  delivered_last_30_days: number;
  failed_or_suppressed_last_30_days: number;
  clicked_last_30_days: number;
  last_sent_at: string | null;
};

type ProgramRun = {
  id: string;
  mode: string;
  status: string;
  scanned_count: number;
  eligible_count: number;
  sent_count: number;
  failed_count: number;
  started_at: string;
};

type BroadcastWindow = {
  id: string;
  label: string;
  starts_at: string;
  ends_at: string;
};

type DashboardData = {
  settings: {
    paused: boolean;
    holdout_percentage: number;
    measurement_started_at: string;
    measurement_ends_at: string;
  };
  campaigns: Campaign[];
  runs: ProgramRun[];
  failures: Array<{
    id: string;
    campaign_key: string;
    status: string;
    last_error: string | null;
    updated_at: string;
  }>;
  broadcastWindows: BroadcastWindow[];
  cohortCounts: Record<string, number>;
  links: { posthog: string; resend: string };
};

const FAMILIARITY_CAMPAIGNS = new Set([
  "onboarding_starting_point",
  "onboarding_technique",
  "onboarding_timing",
  "onboarding_plan",
]);

async function jsonRequest(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Request failed",
    );
  }
  return data;
}

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString("en-AU") : "Never";
}

export default function UcatCampaignsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(
        (await jsonRequest("/api/ucat/email-campaigns")) as DashboardData,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load email campaigns",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    async (key: string, payload: Record<string, unknown>) => {
      setBusy(key);
      setError(null);
      try {
        await jsonRequest("/api/ucat/email-campaigns", {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        await load();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Update failed");
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  async function runDryRun() {
    setBusy("dry-run");
    setError(null);
    try {
      const result = await jsonRequest("/api/ucat/email-campaigns", {
        method: "POST",
        body: JSON.stringify({ action: "dry_run" }),
      });
      setDryRun(JSON.stringify(result, null, 2));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Dry run failed");
    } finally {
      setBusy(null);
    }
  }

  async function scheduleBroadcast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("broadcast");
    setError(null);
    try {
      await jsonRequest("/api/ucat/email-campaigns", {
        method: "POST",
        body: JSON.stringify({
          action: "schedule_broadcast",
          label: form.get("label"),
          startsAt: form.get("startsAt"),
          endsAt: form.get("endsAt"),
        }),
      });
      event.currentTarget.reset();
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not schedule window",
      );
    } finally {
      setBusy(null);
    }
  }

  async function deleteBroadcast(id: string) {
    setBusy("broadcast-" + id);
    try {
      await jsonRequest("/api/ucat/email-campaigns", {
        method: "POST",
        body: JSON.stringify({ action: "delete_broadcast", windowId: id }),
      });
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not remove window",
      );
    } finally {
      setBusy(null);
    }
  }

  if (!data) {
    return (
      <div className="p-6">
        <SettingsPageHeader title="UCAT email campaigns" />
        <p className="mt-6 text-sm text-muted-foreground">
          {error || "Loading campaign controls…"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <SettingsPageHeader title="UCAT email campaigns" />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Programme status</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Supabase decides eligibility and consent. Resend delivers;
                PostHog measures outcomes.
              </p>
            </div>
            <button
              type="button"
              disabled={busy === "pause"}
              onClick={() =>
                void update("pause", { paused: !data.settings.paused })
              }
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {data.settings.paused ? (
                <PlayCircle size={16} />
              ) : (
                <PauseCircle size={16} />
              )}
              {data.settings.paused
                ? "Resume programme"
                : "Pause all optional email"}
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="mt-1 font-semibold">
                {data.settings.paused ? "Paused" : "Active"}
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">
                Measurement holdout
              </div>
              <div className="mt-1 font-semibold">
                {data.settings.holdout_percentage}%
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">
                Treatment / holdout
              </div>
              <div className="mt-1 font-semibold">
                {data.cohortCounts.treatment ?? 0} /{" "}
                {data.cohortCounts.holdout ?? 0}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Analysis</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Clicks are diagnostic. Judge the programme on retention, upgrades
            and accepted referrals.
          </p>
          <div className="mt-4 space-y-2">
            <a
              href={data.links.posthog}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-primary"
            >
              Open PostHog outcomes <ExternalLink size={14} />
            </a>
            <a
              href={data.links.resend}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-primary"
            >
              Open Resend broadcasts <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <div>
            <h2 className="text-lg font-semibold">Campaign controls</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Copy and eligibility remain code-reviewed. These switches are the
              safe operational controls.
            </p>
          </div>
          <button
            type="button"
            disabled={busy === "dry-run"}
            onClick={() => void runDryRun()}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={busy === "dry-run" ? "animate-spin" : ""}
            />
            Run dry check
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Campaign</th>
                <th className="px-3 py-3 font-medium">Topic</th>
                <th className="px-3 py-3 font-medium">30d sent</th>
                <th className="px-3 py-3 font-medium">Delivered</th>
                <th className="px-3 py-3 font-medium">Clicked</th>
                <th className="px-3 py-3 font-medium">Failed</th>
                <th className="px-3 py-3 font-medium">Last sent</th>
                <th className="px-5 py-3 font-medium">Control</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((campaign) => (
                <tr key={campaign.campaign_key} className="border-t">
                  <td className="px-5 py-4">
                    <div className="font-medium">{campaign.display_name}</div>
                    <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                      <span>Priority {campaign.priority}</span>
                      <span>{campaign.cooldown_days}d cooldown</span>
                      {campaign.campaign_key !== "product_news" ? (
                        <a
                          href={
                            "/api/ucat/email-campaigns/preview?campaign=" +
                            campaign.campaign_key +
                            (FAMILIARITY_CAMPAIGNS.has(campaign.campaign_key)
                              ? "&familiarity=new"
                              : "")
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-primary"
                        >
                          Preview
                        </a>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-muted-foreground">
                    {campaign.topic.replaceAll("_", " ")}
                  </td>
                  <td className="px-3 py-4">{campaign.sent_last_30_days}</td>
                  <td className="px-3 py-4">
                    {campaign.delivered_last_30_days}
                  </td>
                  <td className="px-3 py-4">{campaign.clicked_last_30_days}</td>
                  <td className="px-3 py-4">
                    {campaign.failed_or_suppressed_last_30_days}
                  </td>
                  <td className="px-3 py-4 text-xs text-muted-foreground">
                    {dateTime(campaign.last_sent_at)}
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={campaign.enabled}
                      aria-label={
                        (campaign.enabled ? "Disable " : "Enable ") +
                        campaign.display_name
                      }
                      disabled={busy === campaign.campaign_key}
                      onClick={() =>
                        void update(campaign.campaign_key, {
                          campaignKey: campaign.campaign_key,
                          enabled: !campaign.enabled,
                        })
                      }
                      className={
                        "rounded-full px-3 py-1 text-xs font-semibold " +
                        (campaign.enabled
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-muted text-muted-foreground")
                      }
                    >
                      {campaign.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Product-news coordination</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Schedule a suppression window around each Resend Broadcast so
            automation waits its turn.
          </p>
          <form
            onSubmit={scheduleBroadcast}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <label className="sm:col-span-2 text-sm">
              <span className="mb-1 block font-medium">Broadcast label</span>
              <input
                name="label"
                required
                className="w-full rounded-lg border bg-background px-3 py-2"
                placeholder="New adaptive plan release"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Suppress from</span>
              <input
                name="startsAt"
                type="datetime-local"
                required
                className="w-full rounded-lg border bg-background px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Suppress until</span>
              <input
                name="endsAt"
                type="datetime-local"
                required
                className="w-full rounded-lg border bg-background px-3 py-2"
              />
            </label>
            <button
              type="submit"
              disabled={busy === "broadcast"}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2"
            >
              Add broadcast window
            </button>
          </form>
          <div className="mt-5 space-y-2">
            {data.broadcastWindows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No broadcast windows scheduled.
              </p>
            ) : (
              data.broadcastWindows.map((window) => (
                <div
                  key={window.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3 text-sm"
                >
                  <div>
                    <div className="font-medium">{window.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {dateTime(window.starts_at)} – {dateTime(window.ends_at)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteBroadcast(window.id)}
                    disabled={busy === "broadcast-" + window.id}
                    className="text-xs font-medium text-destructive"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Recent scheduler runs</h2>
          <div className="mt-4 space-y-2">
            {data.runs.map((run) => (
              <div
                key={run.id}
                className="grid grid-cols-[1fr_auto] gap-3 rounded-lg bg-muted/40 p-3 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {run.mode.replace("_", " ")} · {run.status}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {dateTime(run.started_at)}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {run.scanned_count} scanned
                  <br />
                  {run.eligible_count} eligible · {run.sent_count} sent ·{" "}
                  {run.failed_count} failed
                </div>
              </div>
            ))}
          </div>
          {dryRun ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium">
                Latest dry-check result
              </summary>
              <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                {dryRun}
              </pre>
            </details>
          ) : null}
        </div>
      </section>

      {data.failures.length > 0 ? (
        <section className="rounded-xl border border-destructive/20 bg-card p-5">
          <h2 className="text-lg font-semibold">
            Recent failures and suppressions
          </h2>
          <div className="mt-4 space-y-2">
            {data.failures.map((failure) => (
              <div
                key={failure.id}
                className="rounded-lg bg-destructive/5 p-3 text-sm"
              >
                <div className="font-medium">
                  {failure.campaign_key} · {failure.status}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {dateTime(failure.updated_at)} ·{" "}
                  {failure.last_error || "No error detail recorded"}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Mail size={14} />
        Preview all three onboarding familiarity variants by changing the
        familiarity query parameter to new, familiar, or experienced.
      </p>
    </div>
  );
}
