"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { createUcatCheckoutSession } from "@/features/subscription/api/create-checkout";
import { fetchPublicSubscriptionConfig } from "@/features/subscription/api/fetch-public-subscription-config";
import { defaultPublicSubscriptionConfig } from "@/features/subscription/types/public-subscription-config";
import { formatMoneyFromMinorUnits } from "@/features/subscription/lib/format-subscription-copy";
import { useAuth } from "@/features/auth";
import { NoiseOverlay } from "@/features/landing/components/marketing/noise-overlay";
import { getTrialBookingUrl } from "@/features/landing/lib/trial-booking-url";
import { UcatLandingFooter } from "@/features/landing/components/marketing/ucat-landing-footer";

const { typography: typo } = MARKETING_TOKENS;

const MONTHLY_PRICE_ID = "price_1TUoHxKMw7Xacevsm4h5ulH8";

type PlanId = "weekly" | "monthly";

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className="h-4 w-4 shrink-0"
      aria-hidden
    >
      <circle cx="8" cy="8" r="7.5" stroke="currentColor" strokeOpacity={0.3} />
      <path
        d="M5 8l2.5 2.5L11 6"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ONLINE_FEATURES = [
  "Full practice set library — all UCAT sections",
  "Full-length mock exams + percentile tracking",
  "Adaptive skill trainer with performance analytics",
  "Progress dashboard with session history",
  "7-day free trial — no credit card required",
];

export function SubscribePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [cfg, setCfg] = useState(defaultPublicSubscriptionConfig);
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleOnlineSubscribe = async (plan: PlanId) => {
    if (!user) {
      router.push(`/signup?redirect=${encodeURIComponent("/subscribe")}`);
      return;
    }
    setLoadingPlan(plan);
    setError(null);
    try {
      const priceId = plan === "monthly" ? MONTHLY_PRICE_ID : undefined;
      const { url } = await createUcatCheckoutSession(priceId);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start checkout");
      setLoadingPlan(null);
    }
  };

  const weeklyPrice = formatMoneyFromMinorUnits(cfg.basePriceCents, cfg.currency);
  // Monthly display: ~25% discount vs weekly * 4 (approx monthly commitment benefit)
  const monthlyBaseCents = Math.round((cfg.basePriceCents * 4) * 0.75);
  const monthlyPrice = formatMoneyFromMinorUnits(monthlyBaseCents, cfg.currency);

  return (
    <div className="relative flex min-h-dvh flex-col bg-marketing-cream">
      <NoiseOverlay />

      {/* Navbar */}
      <header className="fixed left-1/2 top-6 z-50 flex h-16 w-[90%] max-w-5xl -translate-x-1/2 items-center justify-between rounded-full border border-black/5 bg-marketing-cream/80 px-6 shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl">
        <Link href="/" className="flex items-center">
          <Image
            src="/images/logo-banner-light.svg"
            alt="Alti UCAT"
            width={120}
            height={28}
            className="h-7 w-auto object-contain"
            priority
          />
        </Link>
        <div className={`flex items-center gap-4 text-sm text-marketing-charcoal/70 ${typo.secondarySans}`}>
          {!authLoading && (
            user ? (
              <Link href="/dashboard" className="transition-colors hover:text-marketing-charcoal">
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href={`/login?redirect=${encodeURIComponent("/subscribe")}`}
                  className="transition-colors hover:text-marketing-charcoal"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-marketing-primary px-5 py-1.5 text-marketing-cream transition-colors hover:bg-marketing-primary/90"
                >
                  Register
                </Link>
              </>
            )
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-40 pb-24 px-4">
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
          <p className={`mx-auto mt-6 max-w-2xl text-lg text-marketing-charcoal/60 sm:text-xl ${typo.secondarySans}`}>
            Precision practice, adaptive analytics, and full-length mocks.
            Start free for 7 days — no credit card required.
          </p>

          {/* Feature pills */}
          <div className={`mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-marketing-charcoal/70 ${typo.secondarySans}`}>
            {ONLINE_FEATURES.map((f) => (
              <span
                key={f}
                className="flex items-center gap-1.5 rounded-full border border-marketing-charcoal/10 bg-white px-4 py-1.5"
              >
                <CheckIcon /> {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How pricing works */}
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
                  <span className={`mt-0.5 text-2xl ${accent ? "text-marketing-accent" : "text-marketing-cream/40"}`}>
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

      {/* Pricing grid */}
      <section id="pricing" className="bg-marketing-cream px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className={`text-4xl font-bold text-marketing-charcoal sm:text-5xl ${typo.headingSans}`}>
              Choose your plan
            </h2>
            <p className={`mt-4 text-marketing-charcoal/60 ${typo.secondarySans}`}>
              All online plans include the same full access. Pay weekly or save with monthly.
            </p>
          </div>

          {error ? (
            <div className={`mx-auto mb-8 max-w-md rounded-2xl bg-red-500/10 p-4 text-center text-sm text-red-600 ${typo.secondarySans}`}>
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3">
            {/* Card 1: Weekly online */}
            <div className="relative flex flex-col justify-between overflow-hidden rounded-[2.5rem] bg-white p-8 shadow-lg ring-1 ring-black/5 transition-all duration-300 hover:shadow-xl hover:ring-marketing-primary/20 md:p-10">
              <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-full bg-marketing-primary/8 blur-2xl" />
              <div>
                <span
                  className={`text-xs font-bold uppercase tracking-widest text-marketing-primary ${typo.dataMono}`}
                >
                  Online
                </span>
                <h3 className={`mt-3 text-2xl font-bold text-marketing-charcoal ${typo.headingSans}`}>
                  Weekly online
                </h3>
                <p className={`mt-3 text-sm text-marketing-charcoal/60 ${typo.secondarySans}`}>
                  Complete your weekly practice and keep your cost low. Billed every week.
                </p>

                <div className="mt-6 space-y-1">
                  {/* Penalty price — crossed out */}
                  <p className={`text-sm text-marketing-charcoal/30 line-through ${typo.dataMono}`}>
                    ~$149/mo penalty rate
                  </p>
                  {/* Standard price */}
                  <div className="flex items-end gap-2">
                    <span className={`text-4xl font-bold text-marketing-charcoal ${typo.headingSans}`}>
                      {weeklyPrice}
                    </span>
                    <span className={`mb-1 text-marketing-charcoal/50 ${typo.secondarySans}`}>
                      /wk standard
                    </span>
                  </div>
                  <p className={`text-xs text-marketing-primary ${typo.dataMono}`}>
                    {cfg.trialDays > 0 ? `${cfg.trialDays}-day free trial` : "No trial — starts immediately"}
                  </p>
                </div>

                <ul className={`mt-6 space-y-2.5 text-sm text-marketing-charcoal/70 ${typo.secondarySans}`}>
                  {ONLINE_FEATURES.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-marketing-primary">
                      <CheckIcon />
                      <span className="text-marketing-charcoal/70">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => void handleOnlineSubscribe("weekly")}
                disabled={loadingPlan !== null}
                className={`mt-10 w-full rounded-full border-2 border-marketing-primary py-4 text-base font-semibold text-marketing-primary transition-all hover:bg-marketing-primary hover:text-marketing-cream disabled:cursor-not-allowed disabled:opacity-50 ${typo.headingSans}`}
              >
                {loadingPlan === "weekly" ? "Redirecting…" : "Start free trial"}
              </button>
            </div>

            {/* Card 2: Monthly online (FEATURED) */}
            <div className="relative flex flex-col justify-between overflow-hidden rounded-[2.5rem] bg-marketing-primary p-8 shadow-2xl ring-2 ring-marketing-accent/40 transition-all duration-300 hover:ring-marketing-accent/70 md:p-10 md:scale-[1.03]">
              {/* Best value badge */}
              <div className="absolute right-6 top-6">
                <span
                  className={`rounded-full bg-marketing-accent px-3 py-1 text-xs font-bold uppercase tracking-wider text-marketing-charcoal ${typo.dataMono}`}
                >
                  Best Value
                </span>
              </div>
              <div className="absolute left-0 top-0 h-40 w-40 rounded-br-full bg-marketing-accent/10 blur-3xl" />

              <div>
                <span
                  className={`text-xs font-bold uppercase tracking-widest text-marketing-accent ${typo.dataMono}`}
                >
                  Online
                </span>
                <h3 className={`mt-3 text-2xl font-bold text-marketing-cream ${typo.headingSans}`}>
                  Monthly online
                </h3>
                <p className={`mt-3 text-sm text-marketing-cream/60 ${typo.secondarySans}`}>
                  Commit monthly and save. Everything in weekly, billed once a month.
                </p>

                <div className="mt-6 space-y-1">
                  {/* Penalty price — crossed out */}
                  <p className={`text-sm text-marketing-cream/30 line-through ${typo.dataMono}`}>
                    ~$149/mo penalty rate
                  </p>
                  {/* Standard price */}
                  <div className="flex items-end gap-2">
                    <span className={`text-4xl font-bold text-marketing-cream ${typo.headingSans}`}>
                      {monthlyPrice}
                    </span>
                    <span className={`mb-1 text-marketing-cream/50 ${typo.secondarySans}`}>
                      /mo standard
                    </span>
                  </div>
                  <p className={`text-xs text-marketing-accent ${typo.dataMono}`}>
                    {cfg.trialDays > 0 ? `${cfg.trialDays}-day free trial` : "No trial — starts immediately"}
                  </p>
                </div>

                <ul className={`mt-6 space-y-2.5 text-sm ${typo.secondarySans}`}>
                  {ONLINE_FEATURES.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-marketing-accent">
                      <CheckIcon />
                      <span className="text-marketing-cream/70">{f}</span>
                    </li>
                  ))}
                  <li className="flex items-start gap-2 text-marketing-accent">
                    <CheckIcon />
                    <span className="text-marketing-cream/70">Save ~25% vs weekly billing</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => void handleOnlineSubscribe("monthly")}
                disabled={loadingPlan !== null}
                className={`mt-10 w-full rounded-full bg-marketing-accent py-4 text-base font-semibold text-marketing-charcoal shadow-lg shadow-marketing-accent/30 transition-all hover:bg-marketing-accent/90 disabled:cursor-not-allowed disabled:opacity-50 ${typo.headingSans}`}
              >
                {loadingPlan === "monthly" ? "Redirecting…" : "Start free trial"}
              </button>
            </div>

            {/* Card 3: In person */}
            <div className="relative flex flex-col justify-between overflow-hidden rounded-[2.5rem] bg-marketing-charcoal p-8 shadow-lg transition-all duration-300 hover:shadow-xl md:p-10">
              <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-full bg-marketing-accent/10 blur-2xl" />
              <div>
                <span
                  className={`text-xs font-bold uppercase tracking-widest text-marketing-accent ${typo.dataMono}`}
                >
                  Premium
                </span>
                <h3 className={`mt-3 text-2xl font-bold text-marketing-cream ${typo.headingSans}`}>
                  In person
                </h3>
                <p className={`mt-3 text-sm text-marketing-cream/60 ${typo.secondarySans}`}>
                  Weekly in-person classes with expert tutors. Includes full
                  unrestricted online access at no extra cost.
                </p>

                <div className="mt-6 space-y-1">
                  <div className="flex items-end gap-2">
                    <span className={`text-4xl font-bold text-marketing-cream ${typo.headingSans}`}>
                      $50
                    </span>
                    <span className={`mb-1 text-marketing-cream/50 ${typo.secondarySans}`}>
                      /wk
                    </span>
                  </div>
                  <p className={`text-xs text-marketing-cream/40 ${typo.dataMono}`}>
                    Limited seats available
                  </p>
                </div>

                <ul className={`mt-6 space-y-2.5 text-sm ${typo.secondarySans}`}>
                  {[
                    "Everything in online plans",
                    "Weekly in-person sessions",
                    "Expert UCAT tutors",
                    "Initial 1-on-1 diagnostic assessment",
                    "Book a free trial session to get started",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-marketing-accent">
                      <CheckIcon />
                      <span className="text-marketing-cream/70">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href={getTrialBookingUrl()}
                target="_blank"
                rel="noreferrer"
                className={`mt-10 block w-full rounded-full bg-marketing-accent py-4 text-center text-base font-semibold text-marketing-charcoal shadow-lg shadow-marketing-accent/20 transition-all hover:bg-marketing-accent/90 ${typo.headingSans}`}
              >
                Book trial session
              </a>
            </div>
          </div>

          {/* Footer note */}
          <p className={`mt-10 text-center text-sm text-marketing-charcoal/40 ${typo.secondarySans}`}>
            All prices in AUD and include GST where applicable. Cancel anytime
            before trial ends. Penalty pricing activates only when daily
            practice targets are not met.
          </p>
        </div>
      </section>

      <UcatLandingFooter />
    </div>
  );
}
