"use client";
import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input } from "@altitutor/ui";
import { AdminDialogShell } from "@/shared/components/dialog-shell";
import { getSupabaseClient } from "@/shared/lib/supabase/client";
import { onboardingKey } from "../api/queries";
import type { Journey } from "../lib/model";
import type { Tables } from "@altitutor/shared";
export function MailboxReview({
  journeys,
  onClose,
  onEnquiry,
}: {
  journeys: Journey[];
  onClose: () => void;
  onEnquiry: (email: Tables<"onboarding_emails">) => void;
}) {
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const qc = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: [...onboardingKey, "mailbox-review"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await getSupabaseClient()
        .from("onboarding_emails")
        .select("*,onboarding_email_links(journey_id)")
        .eq("ignored", false)
        .eq("direction", "inbound")
        .order("occurred_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 99);
      if (error) throw error;
      return {
        items: data,
        next: data.length === 100 ? pageParam + 100 : undefined,
      };
    },
    getNextPageParam: (p) => p.next,
  });
  async function sync() {
    setSyncing(true);
    setError("");
    try {
      const response = await fetch("/api/onboarding/mailbox-sync", {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Sync failed.");
      await qc.invalidateQueries({ queryKey: onboardingKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }
  async function link(email: Tables<"onboarding_emails">) {
    if (!selected[email.id]) return;
    const { error } = await getSupabaseClient()
      .from("onboarding_email_links")
      .upsert({ email_id: email.id, journey_id: selected[email.id] });
    if (error) setError(error.message);
    else await qc.invalidateQueries({ queryKey: onboardingKey });
  }
  async function ignore(id: string) {
    const { error } = await getSupabaseClient()
      .from("onboarding_emails")
      .update({ ignored: true })
      .eq("id", id);
    if (error) setError(error.message);
    else await query.refetch();
  }
  const rows = (query.data?.pages.flatMap((p) => p.items) ?? []).filter(
    (m) =>
      !m.onboarding_email_links.length &&
      `${m.subject} ${m.sender}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <AdminDialogShell
      open
      onClose={onClose}
      title="Review mailbox"
      fillHeight
      headerActions={
        <Button
          variant="outline"
          disabled={syncing}
          onClick={() => void sync()}
        >
          {syncing ? "Synchronizing…" : "Sync mailbox"}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Confirm an enquiry before it enters conversion reporting. Linking mail
          to a student already in the queue does not create another journey.
          Parcels and subscriptions can be ignored.
        </p>
        <Input
          placeholder="Search sender or subject"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {(error || query.error) && (
          <p role="alert" className="text-destructive">
            {error || query.error?.message}
          </p>
        )}
        {rows.map((m) => (
          <article key={m.id} className="border rounded-lg p-3 space-y-2">
            <div className="text-xs text-muted-foreground">
              {m.sender} · {new Date(m.occurred_at).toLocaleString("en-AU")}
            </div>
            <h3 className="font-medium">{m.subject}</h3>
            <details>
              <summary className="text-sm cursor-pointer">Read email</summary>
              <p className="whitespace-pre-wrap text-sm py-2">{m.body_text}</p>
            </details>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label={`Journey for ${m.subject}`}
                className="bg-background border rounded p-1 text-sm"
                value={selected[m.id] ?? ""}
                onChange={(e) =>
                  setSelected((s) => ({ ...s, [m.id]: e.target.value }))
                }
              >
                <option value="">Existing journey…</option>
                {journeys.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.label}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                disabled={!selected[m.id]}
                onClick={() => void link(m)}
              >
                Link
              </Button>
              <Button size="sm" onClick={() => onEnquiry(m)}>
                New enquiry
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void ignore(m.id)}
              >
                Ignore
              </Button>
            </div>
          </article>
        ))}
        {!rows.length && !query.isLoading && (
          <p className="text-sm text-muted-foreground">
            No unreviewed emails loaded.
          </p>
        )}
        {query.hasNextPage && (
          <Button variant="outline" onClick={() => void query.fetchNextPage()}>
            Load older emails
          </Button>
        )}
      </div>
    </AdminDialogShell>
  );
}
