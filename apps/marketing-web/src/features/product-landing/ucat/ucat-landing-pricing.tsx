"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Info, MapPin, Video } from "lucide-react";
import {
  MARKETING_TOKENS,
  maxPracticeDayDiscountCents,
  periodCentsToPerWeekCents,
  type UcatBillingInterval,
} from "@altitutor/shared";
import { SegmentedControl } from "@altitutor/ui";
import { AnalyticsLink } from "../analytics-link";
import { PRODUCT_LINKS } from "@/lib/site";
import { MagneticButton } from "./magnetic-button";
import { UcatInterestDialog } from "./ucat-interest-dialog";

const { typography: typo } = MARKETING_TOKENS;

type FreeQuota = { limit: number; period: "day" | "week" | "month" };
type PublicSubscriptionConfig = {
  trialDays: number;
  minQuestionsPerDay: number;
  currency: string;
  freeQuotas: Record<string, FreeQuota>;
  planPrices: Array<{
    tier: string;
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
  "Unlimited question practice across every UCAT section",
  "Full access to 30+ full mocks and timed sets",
  "Unlimited skill trainers and learning modules",
  "Detailed review, progress tracking, and score estimation",
  "No waiting for Free allowances to reset",
] as const;

function checkoutHref(interval: UcatBillingInterval) {
  const checkout = `/checkout?tier=unlimited&interval=${interval}&context=signup_onboarding`;
  return `${PRODUCT_LINKS.ucatSignup}?redirect=${encodeURIComponent(checkout)}`;
}

function formatQuota(label: string, quota: FreeQuota) {
  return `${quota.limit} ${label.toLowerCase()} per ${quota.period}`;
}

function CheckItem({
  children,
  dark = false,
}: {
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <li
      className={`flex items-start gap-2.5 ${dark ? "text-marketing-accent" : "text-marketing-primary"}`}
    >
      <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span
        className={
          dark ? "text-marketing-cream/72" : "text-marketing-charcoal/65"
        }
      >
        {children}
      </span>
    </li>
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
        if (!response.ok)
          throw new Error(`Pricing request failed (${response.status})`);
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
          price.tier === "unlimited" &&
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
  const priceRow = config?.planPrices.find(
    (price) => price.tier === "unlimited" && price.interval === interval,
  );
  const formatMoney = (cents: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: config?.currency?.toUpperCase() ?? "AUD",
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);

  const price =
    priceRow && discount
      ? {
          standardPeriodCents: priceRow.basePriceCents,
          standardWeeklyCents: periodCentsToPerWeekCents(
            priceRow.basePriceCents,
            interval,
          ),
          idealWeeklyCents: periodCentsToPerWeekCents(
            Math.max(
              0,
              priceRow.basePriceCents -
                maxPracticeDayDiscountCents(
                  discount.discountPerDayCents,
                  discount.maxDiscountsPerPeriod,
                ),
            ),
            interval,
          ),
        }
      : null;
  const checkoutAvailable = Boolean(
    priceRow?.checkoutEnabled &&
      priceRow.configured &&
      config?.unlimitedProductConfigured,
  );
  const includedFreeQuotas = config
    ? FREE_QUOTAS.filter(([key]) => (config.freeQuotas[key]?.limit ?? 0) > 0)
    : FREE_QUOTAS;

  return (
    <section
      id="pricing"
      className="bg-marketing-cream px-4 py-24 sm:px-8 sm:py-32"
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p
            className={`text-xs font-semibold uppercase tracking-[0.18em] text-marketing-primary/60 ${typo.dataMono}`}
          >
            Pricing
          </p>
          <h2
            className={`mt-4 text-4xl font-semibold tracking-[-0.035em] text-marketing-charcoal sm:text-5xl ${typo.headingSans}`}
          >
            Prepare at the pace that works for you.
          </h2>
          <p
            className={`mx-auto mt-6 max-w-2xl text-base leading-relaxed text-marketing-charcoal/60 sm:text-lg ${typo.secondarySans}`}
          >
            Keep preparing free, or go Unlimited when you want to move faster.
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          <SegmentedControl
            value={interval}
            onValueChange={setInterval}
            options={availableIntervals.map((candidate) => ({
              value: candidate,
              label: INTERVAL_LABELS[candidate],
            }))}
            variant="light"
            aria-label="Unlimited billing interval"
            className="!rounded-full text-sm [&>div]:!rounded-full [&_button]:!px-5 [&_button]:!py-2.5 sm:[&_button]:!px-8"
          />
        </div>

        {loadFailed ? (
          <p
            className={`mx-auto mt-6 max-w-lg rounded-2xl bg-red-500/10 p-4 text-center text-sm text-red-700 ${typo.secondarySans}`}
          >
            Live pricing could not be loaded. You can still start with Free.
          </p>
        ) : null}

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <article className="flex flex-col justify-between rounded-[2.25rem] border border-marketing-charcoal/10 bg-white p-7 shadow-sm sm:p-10">
            <div>
              <p
                className={`text-xs font-semibold uppercase tracking-[0.15em] text-marketing-primary/55 ${typo.dataMono}`}
              >
                Altitutor UCAT Free
              </p>
              <h3
                className={`mt-4 text-3xl font-semibold text-marketing-charcoal ${typo.headingSans}`}
              >
                A complete start. Free forever.
              </h3>
              <p
                className={`mt-4 text-sm leading-relaxed text-marketing-charcoal/60 ${typo.secondarySans}`}
              >
                Learn, practice, review, and track your progress with allowances
                that reset. This is ongoing access—not a trial you eventually
                use up.
              </p>
              <div className="mt-7 flex items-end gap-2">
                <span
                  className={`text-5xl font-bold text-marketing-primary ${typo.headingSans}`}
                >
                  $0
                </span>
                <span
                  className={`mb-1 text-sm text-marketing-charcoal/50 ${typo.secondarySans}`}
                >
                  for as long as you need
                </span>
              </div>
              <ul className={`mt-8 space-y-3 text-sm ${typo.secondarySans}`}>
                {includedFreeQuotas.map(([key, label]) => (
                  <CheckItem key={key}>
                    {config && config.freeQuotas[key]
                      ? formatQuota(label, config.freeQuotas[key])
                      : label}
                  </CheckItem>
                ))}
              </ul>
            </div>
            <AnalyticsLink
              href={PRODUCT_LINKS.ucatSignup}
              analytics={{
                product: "ucat",
                placement: "pricing",
                action: "start_free",
                planTier: "free",
              }}
              className="mt-10"
            >
              <MagneticButton className="w-full border border-marketing-primary/20 bg-marketing-cream px-6 py-4 text-base font-semibold text-marketing-primary">
                Start preparing free{" "}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </MagneticButton>
            </AnalyticsLink>
          </article>

          <article className="relative flex flex-col justify-between overflow-hidden rounded-[2.25rem] bg-marketing-primary p-7 text-marketing-cream shadow-2xl sm:p-10">
            <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-marketing-accent/10 blur-[60px]" />
            <div className="relative">
              <p
                className={`text-xs font-semibold uppercase tracking-[0.15em] text-marketing-accent ${typo.dataMono}`}
              >
                Altitutor UCAT Unlimited
              </p>
              <h3 className={`mt-4 text-3xl font-semibold ${typo.headingSans}`}>
                Practice without waiting.
              </h3>
              <p
                className={`mt-4 text-sm leading-relaxed text-white/67 ${typo.secondarySans}`}
              >
                Remove limits across the platform when you want to prepare
                faster or more intensively.
              </p>
              {(config?.trialDays ?? 0) > 0 ? (
                <p
                  className={`mt-5 inline-flex rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-marketing-accent ${typo.secondarySans}`}
                >
                  {config?.trialDays}-day Unlimited trial for eligible new
                  students
                </p>
              ) : null}

              {!config ? (
                <div
                  className="mt-7 h-16 w-64 animate-pulse rounded-xl bg-white/10"
                  aria-label="Loading pricing"
                />
              ) : price ? (
                <div className="mt-7">
                  <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                    <span className={`text-5xl font-bold ${typo.headingSans}`}>
                      {formatMoney(price.idealWeeklyCents)}
                    </span>
                    <span
                      className={`mb-1 text-sm text-white/50 ${typo.secondarySans}`}
                    >
                      / week with practice discounts
                    </span>
                  </div>
                  <p
                    className={`mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-white/48 ${typo.secondarySans}`}
                  >
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    Standard price {formatMoney(price.standardWeeklyCents)} /
                    week without discounts
                    {interval === "week"
                      ? "."
                      : `, billed at ${formatMoney(price.standardPeriodCents)} / ${INTERVAL_SHORT[interval]}.`}
                  </p>
                </div>
              ) : (
                <p
                  className={`mt-7 text-sm text-white/55 ${typo.secondarySans}`}
                >
                  Pricing coming soon
                </p>
              )}

              <ul className={`mt-8 space-y-3 text-sm ${typo.secondarySans}`}>
                {UNLIMITED_FEATURES.map((feature) => (
                  <CheckItem key={feature} dark>
                    {feature}
                  </CheckItem>
                ))}
              </ul>
              <p
                className={`mt-7 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-white/58 ${typo.secondarySans}`}
              >
                Revenue from paid plans helps fund free and subsidised
                educational support through Altitutor.
              </p>
            </div>
            {checkoutAvailable ? (
              <AnalyticsLink
                href={checkoutHref(interval)}
                analytics={{
                  product: "ucat",
                  placement: "pricing",
                  action: "select_plan",
                  planTier: "unlimited",
                }}
                className="relative mt-10"
              >
                <MagneticButton className="w-full bg-marketing-accent px-6 py-4 text-base font-semibold text-marketing-charcoal">
                  Choose Unlimited{" "}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </MagneticButton>
              </AnalyticsLink>
            ) : (
              <span
                className={`relative mt-10 flex w-full items-center justify-center rounded-full bg-white/10 px-6 py-4 text-base font-semibold text-white/45 ${typo.headingSans}`}
              >
                Unlimited coming soon
              </span>
            )}
          </article>
        </div>

        <div className="mt-8 grid gap-8 rounded-[2.25rem] border border-marketing-charcoal/10 bg-white p-7 shadow-sm sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-14">
          <div className="flex gap-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-marketing-accent/30 text-marketing-primary">
              <Video className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p
                className={`text-xs font-semibold uppercase tracking-[0.15em] text-marketing-primary/55 ${typo.dataMono}`}
              >
                Online tutoring · coming soon
              </p>
              <h3
                className={`mt-3 text-2xl font-semibold text-marketing-charcoal ${typo.headingSans}`}
              >
                Want a tutor to work from the same evidence?
              </h3>
              <p
                className={`mt-3 max-w-2xl text-sm leading-relaxed text-marketing-charcoal/60 ${typo.secondarySans}`}
              >
                We are developing one-to-one online UCAT tutoring by video. Your
                tutor will be able to see your progress and attempts, then help
                you decide what to work on next. Tutoring will be a separate
                add-on, not another platform tier.
              </p>
              <p
                className={`mt-3 text-xs text-marketing-charcoal/45 ${typo.secondarySans}`}
              >
                Joining the waitlist is not a booking or guarantee of
                availability.
              </p>
            </div>
          </div>
          <div className="lg:text-right">
            <UcatInterestDialog
              kind="online_tutoring_waitlist"
              triggerLabel="Join the waitlist"
              title="Join the online tutoring waitlist"
              description="Leave your contact details and Matt will follow up as plans for one-to-one online UCAT tutoring develop. Joining the waitlist is not a booking or guarantee of availability."
              triggerClassName="inline-flex items-center justify-center gap-2 rounded-full bg-marketing-primary px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-marketing-charcoal"
            />
          </div>
        </div>

        <p
          className={`mt-8 flex flex-wrap items-center justify-center gap-2 text-center text-sm text-marketing-charcoal/55 ${typo.secondarySans}`}
        >
          <MapPin className="h-4 w-4 text-marketing-primary" aria-hidden /> In
          Adelaide?
          <AnalyticsLink
            href="/classes/ucatprep/"
            analytics={{
              product: "ucat",
              placement: "pricing",
              action: "explore_in_person",
            }}
            className="font-semibold text-marketing-primary underline-offset-4 hover:underline"
          >
            Explore in-person UCAT classes.
          </AnalyticsLink>
        </p>
      </div>
    </section>
  );
}
