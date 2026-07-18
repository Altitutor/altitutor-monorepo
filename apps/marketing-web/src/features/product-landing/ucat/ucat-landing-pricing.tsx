"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Info, X } from "lucide-react";
import {
  MARKETING_TOKENS,
  maxPracticeDayDiscountCents,
  periodCentsToPerWeekCents,
  type UcatBillingInterval,
  type UcatPaidPlanTier,
} from "@altitutor/shared";
import { SegmentedControl } from "@altitutor/ui";
import { AnalyticsLink } from "../analytics-link";
import { PRODUCT_LINKS } from "@/lib/site";
import { MagneticButton } from "./magnetic-button";

const { typography: typo } = MARKETING_TOKENS;

type FreeQuota = {
  limit: number;
  period: "day" | "week" | "month";
};

type PublicSubscriptionConfig = {
  trialDays: number;
  minQuestionsPerDay: number;
  currency: string;
  freeQuotas: Record<string, FreeQuota>;
  planPrices: Array<{
    tier: UcatPaidPlanTier;
    interval: UcatBillingInterval;
    basePriceCents: number;
    checkoutEnabled: boolean;
    configured: boolean;
  }>;
  practiceDayDiscounts: Array<{
    interval: UcatBillingInterval;
    discountPerDayCents: number;
    maxDiscountsPerPeriod: number;
  }>;
  unlimitedProductConfigured: boolean;
  proProductConfigured: boolean;
};

const INTERVALS: UcatBillingInterval[] = ["week", "month", "year"];
const INTERVAL_LABELS: Record<UcatBillingInterval, string> = {
  week: "Weekly",
  month: "Monthly",
  year: "Yearly",
};
const INTERVAL_SHORT: Record<UcatBillingInterval, string> = {
  week: "wk",
  month: "mo",
  year: "yr",
};
const FREE_QUOTAS = [
  ["practice", "Practice questions"],
  ["sets", "Practice sets"],
  ["mocks", "Mock exams"],
  ["learn", "Learning modules"],
  ["skill_trainer", "Skill trainer sessions"],
] as const;
const UNLIMITED_FEATURES = [
  "Full practice set library — all UCAT sections",
  "Full-length mock exams + percentile tracking",
  "Adaptive skill trainer with performance analytics",
  "Progress dashboard with session history",
  "Unlimited access across all areas",
] as const;
const PRO_FEATURES = [
  "1 online training workshop per month",
  "On-demand help from tutors",
  "1-1 performance review each month",
] as const;

function checkoutHref(
  tier: UcatPaidPlanTier,
  interval: UcatBillingInterval,
) {
  const checkout = `/checkout?tier=${tier}&interval=${interval}&context=signup_onboarding`;
  return `${PRODUCT_LINKS.ucatSignup}?redirect=${encodeURIComponent(checkout)}`;
}

function formatQuota(label: string, quota: FreeQuota) {
  return `${quota.limit} ${label.toLowerCase()} per ${quota.period}`;
}

function CheckItem({ children, featured = false }: { children: React.ReactNode; featured?: boolean }) {
  return (
    <li className={`flex items-start gap-2 ${featured ? "text-marketing-accent" : "text-marketing-primary"}`}>
      <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span className={featured ? "text-marketing-cream/70" : "text-marketing-charcoal/70"}>
        {children}
      </span>
    </li>
  );
}

function ExcludedItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-marketing-charcoal/45">
      <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

function PricingSkeleton() {
  return (
    <div className="mt-6 animate-pulse space-y-3" aria-label="Loading pricing">
      <div className="h-10 w-36 rounded-lg bg-marketing-charcoal/10" />
      <div className="h-4 w-56 rounded bg-marketing-charcoal/10" />
    </div>
  );
}

export function UcatLandingPricing() {
  const [config, setConfig] = useState<PublicSubscriptionConfig | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [interval, setInterval] = useState<UcatBillingInterval>("month");

  useEffect(() => {
    let active = true;
    fetch("/api/ucat/subscription-config/")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Pricing request failed (${response.status})`);
        return (await response.json()) as PublicSubscriptionConfig;
      })
      .then((nextConfig) => {
        if (active) setConfig(nextConfig);
      })
      .catch((error) => {
        console.error("[ucat pricing]", error);
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const availableIntervals = useMemo(() => {
    if (!config) return INTERVALS;
    return INTERVALS.filter((candidate) =>
      config.planPrices.some(
        (price) =>
          price.interval === candidate &&
          price.checkoutEnabled &&
          price.configured,
      ),
    );
  }, [config]);

  useEffect(() => {
    if (!config || availableIntervals.includes(interval)) return;
    setInterval(
      availableIntervals.includes("month")
        ? "month"
        : (availableIntervals[0] ?? "month"),
    );
  }, [availableIntervals, config, interval]);

  const discount = config?.practiceDayDiscounts.find(
    (row) => row.interval === interval,
  );
  const formatMoney = (cents: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: config?.currency?.toUpperCase() ?? "AUD",
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);

  const priceFor = (tier: UcatPaidPlanTier) => {
    const row = config?.planPrices.find(
      (price) => price.tier === tier && price.interval === interval,
    );
    if (!row || !discount) return null;
    const idealPeriodCents = Math.max(
      0,
      row.basePriceCents -
        maxPracticeDayDiscountCents(
          discount.discountPerDayCents,
          discount.maxDiscountsPerPeriod,
        ),
    );
    return {
      standardPeriodCents: row.basePriceCents,
      standardWeeklyCents: periodCentsToPerWeekCents(
        row.basePriceCents,
        interval,
      ),
      idealWeeklyCents: periodCentsToPerWeekCents(
        idealPeriodCents,
        interval,
      ),
    };
  };

  const unlimitedPrice = priceFor("unlimited");
  const proPrice = priceFor("pro");
  const checkoutAvailable = (tier: UcatPaidPlanTier) => {
    const row = config?.planPrices.find(
      (price) => price.tier === tier && price.interval === interval,
    );
    const productConfigured =
      tier === "unlimited"
        ? config?.unlimitedProductConfigured
        : config?.proProductConfigured;
    return Boolean(
      row?.checkoutEnabled && row.configured && productConfigured,
    );
  };

  const PriceBlock = ({ tier, featured = false }: { tier: UcatPaidPlanTier; featured?: boolean }) => {
    const pricing = tier === "pro" ? proPrice : unlimitedPrice;
    if (!config) return <PricingSkeleton />;
    if (!pricing) {
      return <p className={`mt-6 text-sm ${featured ? "text-marketing-cream/60" : "text-marketing-charcoal/50"}`}>Coming soon</p>;
    }
    const body = featured ? "text-marketing-cream" : "text-marketing-charcoal";
    const muted = featured ? "text-marketing-cream/50" : "text-marketing-charcoal/50";
    return (
      <div className="mt-6 space-y-2">
        <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
          <span className={`text-4xl font-bold ${body} ${typo.headingSans}`}>
            {formatMoney(pricing.idealWeeklyCents)}
          </span>
          <span className={`mb-1 ${muted} ${typo.secondarySans}`}>/ week</span>
          <span className={`mb-1 inline-flex items-center gap-1 text-sm ${muted} ${typo.secondarySans}`}>
            with daily practice discounts
            <span title={`Answer at least ${config.minQuestionsPerDay} questions per day to earn ${formatMoney(discount?.discountPerDayCents ?? 0)} off your next bill.`}>
              <Info className="h-3.5 w-3.5" aria-hidden />
            </span>
          </span>
        </div>
        <p className={`text-sm ${muted} ${typo.secondarySans}`}>
          <span className={body}>{formatMoney(pricing.standardWeeklyCents)}</span>
          {interval === "week"
            ? " / week without daily practice discounts"
            : ` / week without daily practice discounts, billed at ${formatMoney(pricing.standardPeriodCents)} / ${INTERVAL_SHORT[interval]}`}
        </p>
      </div>
    );
  };

  const ctaButtonClass = `w-full px-6 py-4 text-base font-semibold tracking-wide ${typo.headingSans}`;
  const includedFreeQuotas = config
    ? FREE_QUOTAS.filter(([key]) => (config.freeQuotas[key]?.limit ?? 0) > 0)
    : FREE_QUOTAS;
  const excludedFreeQuotas = config
    ? FREE_QUOTAS.filter(([key]) => (config.freeQuotas[key]?.limit ?? 0) <= 0)
    : [];

  return (
    <section id="pricing" className="relative flex min-h-dvh w-full flex-col justify-center overflow-hidden bg-marketing-cream py-24 md:py-32">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-8">
        <div className="mb-16 text-center">
          <h2 className={`text-4xl font-bold tracking-tight text-marketing-charcoal sm:text-5xl md:text-6xl ${typo.headingSans}`}>
            Choose your plan
          </h2>
          <p className={`mx-auto mt-6 max-w-2xl text-lg text-marketing-charcoal/60 ${typo.secondarySans}`}>
            Start free, then upgrade when you&apos;re ready. Accountability pricing rewards consistent daily practice.
          </p>
        </div>

        <div className="mb-10 flex justify-center">
          <SegmentedControl
            value={interval}
            onValueChange={setInterval}
            options={availableIntervals.map((candidate) => ({
              value: candidate,
              label: INTERVAL_LABELS[candidate],
            }))}
            variant="light"
            aria-label="UCAT billing interval"
            className="!rounded-full text-sm [&>div]:!rounded-full sm:text-base [&_button]:!px-5 [&_button]:!py-2.5 sm:[&_button]:!px-8 sm:[&_button]:!py-3"
          />
        </div>

        {loadFailed ? (
          <p className={`mx-auto mb-6 max-w-lg rounded-2xl bg-red-500/10 p-4 text-center text-sm text-red-700 ${typo.secondarySans}`}>
            Live pricing could not be loaded. Please try again shortly.
          </p>
        ) : null}

        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
          <article className="relative flex h-full flex-col justify-between overflow-hidden rounded-[2.5rem] bg-white p-8 shadow-lg ring-1 ring-black/5 transition-all hover:shadow-xl md:p-10">
            <div>
              <span className={`text-xs font-bold uppercase tracking-widest text-marketing-charcoal/50 ${typo.dataMono}`}>Free</span>
              <h3 className={`mt-3 text-2xl font-bold text-marketing-charcoal ${typo.headingSans}`}>UCAT Free</h3>
              <p className={`mt-3 text-sm text-marketing-charcoal/60 ${typo.secondarySans}`}>Get started at no cost with limited access to every area of the platform.</p>
              <div className="mt-6 flex items-end gap-2">
                <span className={`text-4xl font-bold text-marketing-charcoal ${typo.headingSans}`}>$0</span>
                <span className={`mb-1 text-marketing-charcoal/50 ${typo.secondarySans}`}>free forever</span>
              </div>
              <p className={`mt-1 text-xs text-marketing-charcoal/50 ${typo.dataMono}`}>Quotas reset daily, weekly, or monthly</p>
              <ul className={`mt-6 space-y-2.5 text-sm ${typo.secondarySans}`}>
                {includedFreeQuotas.map(([key, label]) => (
                  <CheckItem key={key}>{config ? formatQuota(label, config.freeQuotas[key]!) : label}</CheckItem>
                ))}
                {excludedFreeQuotas.map(([key, label]) => (
                  <ExcludedItem key={key}>{label}</ExcludedItem>
                ))}
              </ul>
            </div>
            <AnalyticsLink href={PRODUCT_LINKS.ucatSignup} analytics={{ product: "ucat", placement: "pricing", action: "start_free", planTier: "free" }} className="mt-10 block">
              <MagneticButton className={`${ctaButtonClass} border border-marketing-charcoal/30 text-marketing-charcoal`}>
                Sign up free
              </MagneticButton>
            </AnalyticsLink>
          </article>

          <article className="relative flex h-full flex-col justify-between overflow-hidden rounded-[2.5rem] bg-white p-8 shadow-lg ring-1 ring-black/5 transition-all hover:shadow-xl hover:ring-marketing-primary/20 md:p-10">
            <div>
              <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-full bg-marketing-primary/10 blur-2xl" />
              <span className={`text-xs font-bold uppercase tracking-widest text-marketing-primary ${typo.dataMono}`}>Online</span>
              <h3 className={`mt-3 text-2xl font-bold text-marketing-charcoal ${typo.headingSans}`}>UCAT Unlimited</h3>
              <p className={`mt-3 text-sm text-marketing-charcoal/60 ${typo.secondarySans}`}>Unlimited online practice with accountability pricing — complete your daily targets to keep costs low.</p>
              {(config?.trialDays ?? 0) > 0 ? <p className={`mt-4 inline-flex rounded-full bg-marketing-primary/10 px-3 py-1 text-xs font-semibold text-marketing-primary ${typo.secondarySans}`}>{config?.trialDays}-day UCAT Unlimited trial for eligible new students</p> : null}
              <PriceBlock tier="unlimited" />
              <p className={`mt-6 text-sm font-semibold text-marketing-charcoal/80 ${typo.secondarySans}`}>Everything in Free, plus</p>
              <ul className={`mt-3 space-y-2.5 text-sm ${typo.secondarySans}`}>{UNLIMITED_FEATURES.map((feature) => <CheckItem key={feature}>{feature}</CheckItem>)}</ul>
            </div>
            {checkoutAvailable("unlimited") ? (
              <AnalyticsLink href={checkoutHref("unlimited", interval)} analytics={{ product: "ucat", placement: "pricing", action: "select_plan", planTier: "unlimited" }} className="mt-10 block">
                <MagneticButton className={`${ctaButtonClass} bg-marketing-accent text-marketing-charcoal shadow-lg shadow-marketing-accent/30`}>
                  Sign up
                </MagneticButton>
              </AnalyticsLink>
            ) : (
              <span className={`mt-10 flex w-full cursor-not-allowed items-center justify-center rounded-full bg-marketing-charcoal/10 ${ctaButtonClass} text-marketing-charcoal/45`}>
                Coming soon
              </span>
            )}
          </article>

          <article className="relative flex h-full flex-col justify-between overflow-hidden rounded-[2.5rem] bg-marketing-primary p-8 shadow-2xl ring-2 ring-marketing-accent/40 transition-all hover:ring-marketing-accent/70 md:p-10 xl:scale-[1.03]">
            <div>
              <div className="absolute left-0 top-0 h-40 w-40 rounded-br-full bg-marketing-accent/10 blur-3xl" />
              <span className={`text-xs font-bold uppercase tracking-widest text-marketing-accent ${typo.dataMono}`}>Online + tutors</span>
              <h3 className={`mt-3 text-2xl font-bold text-marketing-cream ${typo.headingSans}`}>UCAT Pro</h3>
              <p className={`mt-3 text-sm text-marketing-cream/60 ${typo.secondarySans}`}>Everything in Unlimited, plus workshops, on-demand tutor help, and monthly 1-1 performance reviews.</p>
              {(config?.trialDays ?? 0) > 0 ? <p className={`mt-4 inline-flex rounded-full bg-marketing-accent/15 px-3 py-1 text-xs font-semibold text-marketing-accent ${typo.secondarySans}`}>{config?.trialDays}-day UCAT Unlimited trial for eligible new students</p> : null}
              <PriceBlock tier="pro" featured />
              <p className={`mt-6 text-sm font-semibold text-marketing-cream/80 ${typo.secondarySans}`}>Everything in Unlimited, plus</p>
              <ul className={`mt-3 space-y-2.5 text-sm ${typo.secondarySans}`}>{PRO_FEATURES.map((feature) => <CheckItem key={feature} featured>{feature}</CheckItem>)}</ul>
            </div>
            {checkoutAvailable("pro") ? (
              <AnalyticsLink href={checkoutHref("pro", interval)} analytics={{ product: "ucat", placement: "pricing", action: "select_plan", planTier: "pro" }} className="mt-10 block">
                <MagneticButton className={`${ctaButtonClass} bg-marketing-accent text-marketing-charcoal shadow-lg shadow-marketing-accent/30`}>
                  Sign up
                </MagneticButton>
              </AnalyticsLink>
            ) : (
              <span className={`mt-10 flex w-full cursor-not-allowed items-center justify-center rounded-full bg-marketing-cream/10 ${ctaButtonClass} text-marketing-cream/50`}>
                Coming soon
              </span>
            )}
          </article>
        </div>

        <p className={`mx-auto mt-10 max-w-2xl text-center text-sm text-marketing-charcoal/50 ${typo.secondarySans}`}>
          Already have an account? <AnalyticsLink href={PRODUCT_LINKS.ucatLogin} analytics={{ product: "ucat", placement: "pricing", action: "login" }} className="font-medium text-marketing-primary underline-offset-2 hover:underline">Log in</AnalyticsLink> to manage or change your plan.
        </p>
      </div>
    </section>
  );
}
