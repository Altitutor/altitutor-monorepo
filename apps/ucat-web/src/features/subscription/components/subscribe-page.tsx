"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { fetchPublicSubscriptionConfig } from "@/features/subscription/api/fetch-public-subscription-config";
import {
  defaultPublicSubscriptionConfig,
  getPublicPracticeDayDiscount,
} from "@/features/subscription/types/public-subscription-config";
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
    access.onlineTier === "free" && !access.isLoading && access.signupCompleted;
  const monthlyPracticeDiscount = getPublicPracticeDayDiscount(cfg, "month");

  return (
    <div className="relative flex min-h-dvh flex-col bg-marketing-cream">
      <NoiseOverlay />

      {freeIsCurrentPlan ? (
        <div
          className={`sticky top-0 z-20 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-marketing-primary/15 bg-white/90 px-4 py-3 text-center text-sm shadow-sm backdrop-blur-md ${typo.secondarySans}`}
        >
          <span className="text-marketing-charcoal/70">
            You&apos;re on UCAT Free. Compare paid plans below or return to the
            app.
          </span>
          <Link
            href="/dashboard"
            className={`shrink-0 font-semibold text-marketing-primary underline-offset-4 hover:underline ${typo.headingSans}`}
          >
            Back to dashboard
          </Link>
        </div>
      ) : null}

      <section className="relative px-4 pt-24 pb-24">
        <div className="mx-auto max-w-4xl text-center">
          <span
            className={`text-xs font-bold uppercase tracking-[0.25em] text-marketing-primary ${typo.dataMono}`}
          >
            Alti UCAT Prep
          </span>
          <h1
            className={`mt-4 text-5xl font-bold leading-tight text-marketing-charcoal sm:text-6xl md:text-7xl ${typo.headingSans}`}
          >
            Everything you need to{" "}
            <span
              className={`italic text-marketing-primary/80 ${typo.dramaSerif}`}
            >
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
                <span
                  className={`italic text-marketing-accent/80 ${typo.dramaSerif}`}
                >
                  earns discounts
                </span>
              </h2>
              <p
                className={`mt-5 text-marketing-cream/60 ${typo.secondarySans}`}
              >
                Turn consistent practice into real savings. Reach your daily
                question target to earn discounts from the standard subscription
                price while building the routine UCAT preparation demands.
              </p>
            </div>
            <div className="space-y-4">
              {[
                {
                  icon: "✦",
                  title: "Earn as you practise",
                  desc: monthlyPracticeDiscount
                    ? `Complete ${cfg.minQuestionsPerDay}+ questions in a day and earn ${formatMoneyFromMinorUnits(monthlyPracticeDiscount.discountPerDayCents, cfg.currency)} off your bill (up to ${monthlyPracticeDiscount.maxDiscountsPerPeriod} days per billing period on monthly).`
                    : `Complete ${cfg.minQuestionsPerDay}+ questions in a day to earn discounts off your bill.`,
                  accent: true,
                },
                {
                  icon: "⚡",
                  title: "A clear standard price",
                  desc: "See the full subscription price and the maximum practice discount before you subscribe.",
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
                    <p
                      className={`font-semibold text-marketing-cream ${typo.headingSans}`}
                    >
                      {title}
                    </p>
                    <p
                      className={`mt-1 text-sm text-marketing-cream/60 ${typo.secondarySans}`}
                    >
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
            <p
              className={`mt-4 text-marketing-charcoal/60 ${typo.secondarySans}`}
            >
              UCAT Free includes limited access. UCAT Unlimited and UCAT Pro
              unlock everything with accountability pricing.
            </p>
          </div>

          <PlanPicker variant="page" selectorTheme="light" />

          <p
            className={`mt-10 text-center text-sm text-marketing-charcoal/40 ${typo.secondarySans}`}
          >
            All prices in AUD and include GST where applicable. Cancel anytime
            before trial ends. Practice-day discounts are earned when daily
            question targets are met.
          </p>
        </div>
      </section>

      <section className="bg-white px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 md:grid-cols-[0.7fr_1.3fr] md:items-center">
            <div>
              <span
                className={`text-xs font-bold uppercase tracking-[0.25em] text-marketing-primary ${typo.dataMono}`}
              >
                Student outcome
              </span>
              <h2
                className={`mt-3 text-3xl font-bold text-marketing-charcoal sm:text-4xl ${typo.headingSans}`}
              >
                Support across the path to medicine
              </h2>
            </div>
            <figure className="rounded-3xl bg-marketing-cream p-7 ring-1 ring-marketing-charcoal/10 sm:p-9">
              <blockquote
                className={`text-lg leading-relaxed text-marketing-charcoal/80 ${typo.secondarySans}`}
              >
                “The training course was super helpful in prepping me with the
                communication skills and also ability to clearly describe my
                experiences during my interview. I have accepted an offer for
                medicine at Adelaide uni and got to where I am with the guidance
                and support from the course!”
              </blockquote>
              <figcaption
                className={`mt-5 text-sm font-semibold text-marketing-primary ${typo.headingSans}`}
              >
                Anesha — Student, Altitutor UCAT and Medicine Interview Courses
              </figcaption>
            </figure>
          </div>
        </div>
      </section>
    </div>
  );
}
