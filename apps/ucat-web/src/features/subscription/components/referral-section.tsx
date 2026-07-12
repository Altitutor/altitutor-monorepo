"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Gift, Share2, Users } from "lucide-react";
import { Badge, Button, Skeleton } from "@altitutor/ui";
import {
  fetchUcatReferralSummary,
  type UcatReferralSummary,
} from "@/features/subscription/api/referrals";
import {
  UCAT_PRIMARY_ACTION_BUTTON,
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export function ReferralSection() {
  const [copied, setCopied] = useState(false);
  const { data: summary, error } = useQuery<UcatReferralSummary>({
    queryKey: ["ucat-referrals"],
    queryFn: fetchUcatReferralSummary,
  });

  const referralUrl = useMemo(() => {
    if (!summary || typeof window === "undefined") return "";
    const url = new URL("/signup", window.location.origin);
    url.searchParams.set("ref", summary.code);
    return url.toString();
  }, [summary]);

  async function copyReferralLink() {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function shareReferralLink() {
    if (!referralUrl) return;
    if (navigator.share) {
      await navigator.share({
        title: "Try Altitutor UCAT",
        text: "Join me on Altitutor for UCAT practice.",
        url: referralUrl,
      });
      return;
    }
    await copyReferralLink();
  }

  if (!summary && !error) {
    return (
      <div
        className="space-y-6"
        aria-busy="true"
        aria-label="Loading referrals"
      >
        <Skeleton className="h-52 w-full rounded-ucatShell" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((card) => (
            <Skeleton key={card} className="h-28 rounded-ucatShell" />
          ))}
        </div>
        <Skeleton className="h-28 w-full rounded-ucatShell" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="rounded-ucatShell border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load referrals"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section
        className={cn(
          "rounded-ucatShell overflow-hidden p-6 sm:p-8",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Gift className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold tracking-tight">
                Give a free bill, get a free bill
              </h2>
              <Badge variant="secondary">Refer a friend</Badge>
            </div>
            <p className="mt-3 text-muted-foreground">
              When a new friend starts an eligible UCAT Unlimited or Pro trial,
              both of you earn 100% off your next subscription bill. Weekly
              subscribers get their next week free; monthly subscribers get
              their next month free.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              If you are on UCAT Free, your free-bill reward stays queued until
              you start a paid plan. Each successful referral creates a separate
              future free bill.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void copyReferralLink()}
              aria-live="polite"
            >
              {copied ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button
              type="button"
              className={UCAT_PRIMARY_ACTION_BUTTON}
              onClick={() => void shareReferralLink()}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-muted/35 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your referral link
          </p>
          <p className="mt-2 break-all font-mono text-sm">{referralUrl}</p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Friends joined",
            value: summary.stats.signups,
            icon: Users,
          },
          {
            label: "Free referrals",
            value: summary.stats.freeQualified,
            icon: Check,
          },
          {
            label: "Paid-plan trials",
            value: summary.stats.paidQualified,
            icon: Gift,
          },
          {
            label: "Free bills available",
            value: summary.stats.queuedFreeBills,
            icon: Gift,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className={cn("rounded-ucatShell p-5", UCAT_SURFACE_CARD)}
          >
            <Icon className="h-5 w-5 text-primary" />
            <p className="mt-4 text-3xl font-semibold tabular-nums">{value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>

      <section className={cn("rounded-ucatShell p-6", UCAT_SURFACE_CARD)}>
        <h3 className="font-semibold">Free-tier referrals</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          When your friend signs up with your link, both of you receive a Free
          quota reset to use within 30 days.
        </p>
        {summary.stats.redeemedFreeBills > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            You have already used {summary.stats.redeemedFreeBills} referral
            {summary.stats.redeemedFreeBills === 1 ? " bill" : " bills"}.
          </p>
        ) : null}
      </section>
    </div>
  );
}
