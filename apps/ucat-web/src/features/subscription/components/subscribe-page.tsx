"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { fetchPublicSubscriptionConfig } from "@/features/subscription/api/fetch-public-subscription-config";
import { defaultPublicSubscriptionConfig } from "@/features/subscription/types/public-subscription-config";
import { formatMoneyFromMinorUnits } from "@/features/subscription/lib/format-subscription-copy";
import { PlanPicker } from "@/features/subscription/components/plan-picker/plan-picker";
import { PlanPickerCheckIcon } from "@/features/subscription/components/plan-picker/plan-picker-check-icon";
import { NoiseOverlay } from "@/features/landing/components/marketing/noise-overlay";
import Link from "next/link";
import { useEffect, useState } from "react";

const { typography: typo } = MARKETING_TOKENS;

const ONLINE_FEATURES = [
  "Full practice set library — all UCAT sections",
  "Full-length mock exams + percentile tracking",
  "Adaptive skill trainer with performance analytics",
  "Progress dashboard with session history",
  "Unlimited access across all areas",
];

export function SubscribePage() {
  const access = useUcatAccess();
  const needsOnboarding = !access.isLoading && !access.onboardingCompleted;
  const [cfg, setCfg] = useState(defaultPublicSubscriptionConfig);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchPublicSubscriptionConfig();
      if (!cancelled) setCfg(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const unlimitedTrialEligible = access.unlimitedTrialEligible;
  const freeIsCurrentPlan =
    access.onlineTier === "free" && !access.isLoading && access.onboardingCompleted;

  return (
    <div className="relative flex min-h-dvh flex-col bg-marketing-cream">
      <NoiseOverlay />

      {freeIsCurrentPlan ? (
        <div
          className={`sticky top-0 z-20 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-marketing-primary/15 bg-white/90 px-4 py-3 text-center text-sm shadow-sm backdrop-blur-md ${typo.secondarySans}`}
        >
          <span className="text-marketing-charcoal/70">
            You&apos;re on UCAT Free. Compare paid plans below or return to the app.
          </span>
          <Link
            href="/dashboard"
            className={`shrink-0 font-semibold text-marketing-primary underline-offset-4 hover:underline ${typo.headingSans}`}
          >
            Back to dashboard
          </Link>
        </div>
      ) : null}

      {needsOnboarding ? (
        <div
          className={`sticky top-0 z-20 border-b border-marketing-primary/20 bg-marketing-primary/10 px-4 py-3 text-center text-sm text-marketing-charcoal shadow-sm backdrop-blur-md ${typo.secondarySans}`}
          role="status"
        >
          Choose UCAT Free or start an Unlimited trial to continue into the app.
        </div>
      ) : null}

      <section className="relative px-4 pt-24 pb-24">
        <div className="mx-auto max-w-4xl text-center">
          <span
            className={`text-xs font-bold uppercase tracking-[0.25em] text-marketing-primary ${typo.dataMono}`}
          >
            Alti UCAT Online Platform
          </span>
          <h1
            className={`mt-4 text-5xl font-bold leading-tight text-marketing-charcoal sm:text-6xl md:text-7xl ${typo.headingSans}`}
          >
            Everything you need to{" "}
            <span className={`italic text-marketing-primary/80 ${typo.dramaSerif}`}>
              ace UCAT
            </span>
          </h1>
          <p
            className={`mx-auto mt-6 max-w-2xl text-lg text-marketing-charcoal/60 sm:text-xl ${typo.secondarySans}`}
          >
            Start with UCAT Free, or unlock unlimited online access with UCAT
            Unlimited and UCAT Pro.
            {unlimitedTrialEligible
              ? ` Try Unlimited free for ${cfg.trialDays} days.`
              : null}
          </p>

          <div
            className={`mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-marketing-charcoal/70 ${typo.secondarySans}`}
          >
            {ONLINE_FEATURES.map((f) => (
              <span
                key={f}
                className="flex items-center gap-1.5 rounded-full border border-marketing-charcoal/10 bg-white px-4 py-1.5"
              >
                <PlanPickerCheckIcon /> {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-marketing-charcoal px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
            <div>
              <span
                className={`text-xs font-bold uppercase tracking-[0.25em] text-marketing-accent ${typo.dataMono}`}
              >
                Accountability Pricing
              </span>
              <h2
                className={`mt-4 text-4xl font-bold text-marketing-cream sm:text-5xl ${typo.headingSans}`}
              >
                Your consistency
                <br />
                <span className={`italic text-marketing-accent/80 ${typo.dramaSerif}`}>
                  earns discounts
                </span>
              </h2>
              <p className={`mt-5 text-marketing-cream/60 ${typo.secondarySans}`}>
                We believe in radical accountability. Hit your daily practice
                target and the platform costs almost nothing. Miss it, and the
                penalty fee activates — funding our non-profit mission.
              </p>
            </div>
            <div className="space-y-4">
              {[
                {
                  icon: "✦",
                  title: "Standard price",
                  desc: `Complete ${cfg.minQuestionsPerDay}+ questions in a day and earn ${formatMoneyFromMinorUnits(cfg.discountPerDayCents, cfg.currency)} off your next bill.`,
                  accent: true,
                },
                {
                  icon: "⚡",
                  title: "Penalty price",
                  desc: "Miss your target for too many days and the penalty rate kicks in. It's the price of inconsistency.",
                  accent: false,
                },
                {
                  icon: "◎",
                  title: "Cancel anytime",
                  desc: "No lock-in. Cancel before your trial ends and you won't be charged a cent.",
                  accent: false,
                },
              ].map(({ icon, title, desc, accent }) => (
                <div
                  key={title}
                  className={`flex gap-4 rounded-2xl p-5 ${
                    accent
                      ? "bg-marketing-accent/10 ring-1 ring-marketing-accent/20"
                      : "bg-white/5"
                  }`}
                >
                  <span
                    className={`mt-0.5 text-2xl ${accent ? "text-marketing-accent" : "text-marketing-cream/40"}`}
                  >
                    {icon}
                  </span>
                  <div>
                    <p className={`font-semibold text-marketing-cream ${typo.headingSans}`}>
                      {title}
                    </p>
                    <p className={`mt-1 text-sm text-marketing-cream/60 ${typo.secondarySans}`}>
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-marketing-cream px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2
              className={`text-4xl font-bold text-marketing-charcoal sm:text-5xl ${typo.headingSans}`}
            >
              Choose your plan
            </h2>
            <p className={`mt-4 text-marketing-charcoal/60 ${typo.secondarySans}`}>
              UCAT Free includes limited access. UCAT Unlimited and UCAT Pro
              unlock everything with accountability pricing.
            </p>
          </div>

          <PlanPicker variant="page" />

          <p
            className={`mt-10 text-center text-sm text-marketing-charcoal/40 ${typo.secondarySans}`}
          >
            All prices in AUD and include GST where applicable. Cancel anytime
            before trial ends. Penalty pricing activates only when daily
            practice targets are not met.
          </p>
        </div>
      </section>
    </div>
  );
}
