"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Copy,
  Gift,
  Link2,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge, Skeleton } from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import {
  fetchUcatReferralSummary,
  type UcatReferralSummary,
} from "@/features/subscription/api/referrals";
import { fetchReferralGifts } from "@/features/subscription/api/referral-gifts";
import { ReferralGiftCard } from "@/features/subscription/components/referral-gift-card";
import {
  UCAT_PRIMARY_ACTION_BUTTON,
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export function ReferralSection() {
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const { data: summary, error } = useQuery<UcatReferralSummary>({
    queryKey: ["ucat-referrals"],
    queryFn: fetchUcatReferralSummary,
  });
  const giftQuery = useQuery({
    queryKey: ["ucat-referral-gifts"],
    queryFn: fetchReferralGifts,
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
      {giftQuery.data?.pendingGift ? (
        <ReferralGiftCard
          gift={giftQuery.data.pendingGift}
          onRejected={async () => {
            await Promise.all([
              queryClient.invalidateQueries({
                queryKey: ["ucat-referral-gifts"],
              }),
              queryClient.invalidateQueries({ queryKey: ["ucat-referrals"] }),
            ]);
          }}
        />
      ) : null}

      <section
        className={cn(
          "rounded-ucatShell overflow-hidden",
          UCAT_SURFACE_CARD,
          UCAT_SURFACE_MOTION,
        )}
      >
        <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/[0.12] via-background to-accent/[0.1] p-6 sm:p-8">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="flex flex-col items-start gap-4 sm:flex-row">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Gift className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Refer friends
                  </p>
                  <Badge variant="secondary">Gift Unlimited</Badge>
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Give a free week or month of UCAT Unlimited.
                </h2>
                <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
                  Your friend gets UCAT Unlimited free for the gifted period.
                  When they accept, you earn Unlimited access if you’re on Free,
                  or your next bill free if you’re already subscribed.
                </p>
              </div>
            </div>
          </div>

          <ol className="relative mt-7 grid gap-3 sm:grid-cols-3">
            {[
              ["1", "Share your link", "Send your personal link to a friend."],
              [
                "2",
                "They choose",
                "They have 7 days to accept the Unlimited gift or continue Free.",
              ],
              ["3", "You earn", "Your reward is based on your plan when you referred them."],
            ].map(([step, title, description]) => (
              <li
                key={step}
                className="rounded-2xl border border-border/60 bg-background/65 p-4 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {step}
                  </span>
                  <p className="font-semibold">{title}</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Link2 className="h-4 w-4" aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Your personal referral link
                </p>
              </div>
              <div className="mt-2 rounded-xl border border-border/70 bg-muted/35 px-4 py-3">
                <p className="truncate font-mono text-sm" title={referralUrl}>
                  {referralUrl}
                </p>
              </div>
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
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <div
          className={cn(
            "rounded-ucatShell p-6 lg:col-span-3",
            UCAT_SURFACE_CARD,
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold">Referral activity</h3>
              <p className="text-sm text-muted-foreground">
                See how your invitations are progressing.
              </p>
            </div>
          </div>

          <dl className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-3">
            {[
              ["Friends joined", summary.stats.friendsJoined],
              ["Gifts accepted", summary.stats.giftsAccepted],
              ["Awaiting decision", summary.stats.giftsPending],
            ].map(([label, value]) => (
              <div key={label} className="bg-background p-4">
                <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
                <dt className="mt-1 text-sm text-muted-foreground">{label}</dt>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-ucatShell relative overflow-hidden border border-primary/20 bg-primary/[0.08] p-6 lg:col-span-2">
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/15 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              <p className="text-sm font-semibold">Available rewards</p>
            </div>
            <p className="mt-5 text-4xl font-semibold tabular-nums">
              {summary.stats.availableFreePeriods +
                summary.stats.queuedFreeBills}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.stats.availableFreePeriods +
                summary.stats.queuedFreeBills ===
              1
                ? "reward"
                : "rewards"}{" "}
              ready
            </p>
            <div className="mt-5 flex items-center justify-between border-t border-primary/15 pt-4 text-sm">
              <span className="text-muted-foreground">Already used</span>
              <span className="font-semibold tabular-nums">
                {summary.stats.usedFreePeriods + summary.stats.redeemedFreeBills}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className={cn("rounded-ucatShell p-6", UCAT_SURFACE_CARD)}>
        <h3 className="font-semibold">How your gift is decided</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex gap-3 rounded-2xl bg-muted/35 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium">If you’re on UCAT Free</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                You gift one free week of Unlimited. If they accept, you earn a
                free week of Unlimited to start when you’re ready. If they say
                no thanks, you both receive a Free quota reset.
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-2xl bg-muted/35 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Gift className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium">If you’re already subscribed</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                You gift a free week or month of Unlimited to match your billing
                cadence. If they accept, your next bill is free. UCAT Pro itself
                is never gifted.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
