"use client";

import Link from "next/link";
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
import { fetchReferralGifts } from "@/features/subscription/api/referral-gifts";
import { ReferralGiftCard } from "@/features/subscription/components/referral-gift-card";
import {
  UCAT_REFERRALS_QUERY_KEY,
  useUcatReferralSummary,
} from "@/features/subscription/hooks/use-ucat-referral-summary";
import { useUcatSubscriptionBilling } from "@/features/subscription/hooks/use-ucat-subscription-billing";
import { resolveReferralOfferCopy } from "@/features/subscription/lib/referral-offer-copy";
import { buildAvailableRewardDisplay } from "@/features/subscription/lib/referral-rewards-display";
import {
  UCAT_PRIMARY_ACTION_BUTTON,
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { useCompleteOnboardingTour } from "@/features/onboarding/hooks/use-onboarding-progress";
import { UCAT_REFERRAL_SHARED } from "@/features/onboarding/lib/activation-milestones";

export function ReferralSection() {
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const completeMilestone = useCompleteOnboardingTour();
  const { data: summary, error } = useUcatReferralSummary();
  const giftQuery = useQuery({
    queryKey: ["ucat-referral-gifts"],
    queryFn: fetchReferralGifts,
  });
  const billingQuery = useUcatSubscriptionBilling();
  const offerCopy = useMemo(
    () => resolveReferralOfferCopy(billingQuery.data?.subscription ?? null),
    [billingQuery.data?.subscription],
  );
  const rewardDisplay = useMemo(
    () =>
      buildAvailableRewardDisplay({
        earnedGifts: giftQuery.data?.earnedGifts ?? [],
        queuedFreeBills: summary?.stats.queuedFreeBills ?? 0,
        usedCount:
          (summary?.stats.usedFreePeriods ?? 0) +
          (summary?.stats.redeemedFreeBills ?? 0),
        billingInterval: billingQuery.data?.subscription?.billing_interval,
        planLabel: offerCopy.planLabel,
      }),
    [
      billingQuery.data?.subscription?.billing_interval,
      giftQuery.data?.earnedGifts,
      offerCopy.planLabel,
      summary?.stats.queuedFreeBills,
      summary?.stats.redeemedFreeBills,
      summary?.stats.usedFreePeriods,
    ],
  );

  const referralUrl = useMemo(() => {
    if (!summary || typeof window === "undefined") return "";
    const url = new URL("/signup", window.location.origin);
    url.searchParams.set("ref", summary.code);
    return url.toString();
  }, [summary]);

  async function copyReferralLink() {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    completeMilestone.mutate(UCAT_REFERRAL_SHARED);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function shareReferralLink() {
    if (!referralUrl) return;
    if (navigator.share) {
      completeMilestone.mutate(UCAT_REFERRAL_SHARED);
      await navigator.share({
        title: "Try Altitutor UCAT",
        text: "Join me on Altitutor for UCAT practice.",
        url: referralUrl,
      });
      return;
    }
    await copyReferralLink();
  }

  if ((!summary && !error) || billingQuery.isLoading) {
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
              queryClient.invalidateQueries({
                queryKey: UCAT_REFERRALS_QUERY_KEY,
              }),
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
                  <Badge variant="secondary">{offerCopy.badge}</Badge>
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {offerCopy.headline}
                </h2>
                <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
                  {offerCopy.description}
                </p>
              </div>
            </div>
          </div>

          <ol className="relative mt-7 grid gap-3 sm:grid-cols-3">
            {offerCopy.steps.map(({ step, title, description }) => (
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
                Friends who joined with your link.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-border/60 bg-muted/25 p-5">
            <p className="text-4xl font-semibold tabular-nums tracking-tight">
              {summary.stats.friendsJoined}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.stats.friendsJoined === 1
                ? "friend joined"
                : "friends joined"}
            </p>
          </div>
        </div>

        <div className="rounded-ucatShell relative overflow-hidden border border-primary/20 bg-primary/[0.08] p-6 lg:col-span-2">
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/15 blur-2xl" />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              <p className="text-sm font-semibold">Available rewards</p>
            </div>
            <p className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              {rewardDisplay.title}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {rewardDisplay.detail}
            </p>
            {rewardDisplay.extra ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {rewardDisplay.extra}
              </p>
            ) : null}
            {rewardDisplay.cta ? (
              <Button
                asChild
                type="button"
                className={cn("mt-5 w-full sm:w-auto", UCAT_PRIMARY_ACTION_BUTTON)}
              >
                <Link href={rewardDisplay.cta.href}>
                  {rewardDisplay.cta.label}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
            <div className="mt-auto flex items-center justify-between border-t border-primary/15 pt-4 text-sm">
              <span className="text-muted-foreground">Already used</span>
              <span className="font-semibold tabular-nums">
                {rewardDisplay.usedCount}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
