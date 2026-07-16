"use client";

import { Check, ArrowRight } from "lucide-react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { AnalyticsLink } from "../analytics-link";
import { PRODUCT_LINKS } from "@/lib/site";

const { typography: typo } = MARKETING_TOKENS;

const plans = [
  {
    tier: "free",
    name: "UCAT Free",
    description: "Explore the system and build your first practice habit.",
    features: ["Core practice access", "Starter learning modules", "Basic progress history"],
    cta: "Start free",
    href: PRODUCT_LINKS.ucatSignup,
    featured: false,
  },
  {
    tier: "unlimited",
    name: "UCAT Unlimited",
    description: "Unlimited independent preparation across every UCAT area.",
    features: ["Unlimited question practice", "Full learning curriculum", "Mocks and progress analytics"],
    cta: "Choose Unlimited",
    href: `${PRODUCT_LINKS.ucatSignup}?redirect=${encodeURIComponent("/checkout?tier=unlimited&interval=month&context=signup_onboarding")}`,
    featured: true,
  },
  {
    tier: "pro",
    name: "UCAT Pro",
    description: "The complete system with higher-touch preparation support.",
    features: ["Everything in Unlimited", "Pro preparation features", "Built for intensive study plans"],
    cta: "Choose Pro",
    href: `${PRODUCT_LINKS.ucatSignup}?redirect=${encodeURIComponent("/checkout?tier=pro&interval=month&context=signup_onboarding")}`,
    featured: false,
  },
] as const;

export function UcatLandingPricing() {
  return (
    <section
      id="pricing"
      className="relative flex min-h-dvh w-full flex-col justify-center overflow-hidden bg-marketing-cream py-24 md:py-32"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-8">
        <div className="mb-16 text-center">
          <h2
            className={`text-4xl font-bold tracking-tight text-marketing-charcoal sm:text-5xl md:text-6xl ${typo.headingSans}`}
          >
            Choose your plan
          </h2>
          <p
            className={`mx-auto mt-6 max-w-2xl text-lg text-marketing-charcoal/60 ${typo.secondarySans}`}
          >
            Start free, then choose the level of access that suits your preparation.
            Current pricing is shown before you confirm in the UCAT app.
          </p>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.tier}
              className={`relative flex flex-col rounded-[2.5rem] p-8 shadow-lg ring-1 md:p-10 ${
                plan.featured
                  ? "bg-marketing-primary text-marketing-cream ring-marketing-primary"
                  : "bg-white text-marketing-charcoal ring-black/5"
              }`}
            >
              {plan.featured ? (
                <span className={`mb-6 w-fit rounded-full bg-marketing-accent px-3 py-1 text-xs font-semibold uppercase tracking-wider text-marketing-charcoal ${typo.dataMono}`}>
                  Most popular
                </span>
              ) : null}
              <h3 className={`text-2xl font-bold ${typo.headingSans}`}>{plan.name}</h3>
              <p className={`mt-4 min-h-20 text-base opacity-70 ${typo.secondarySans}`}>
                {plan.description}
              </p>
              <ul className={`my-8 flex-1 space-y-4 ${typo.secondarySans}`}>
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className={`mt-0.5 h-5 w-5 shrink-0 ${plan.featured ? "text-marketing-accent" : "text-marketing-primary"}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <AnalyticsLink
                href={plan.href}
                analytics={{
                  product: "ucat",
                  placement: "pricing",
                  action: plan.tier === "free" ? "start_free" : "select_plan",
                  planTier: plan.tier,
                }}
                className={`flex items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-semibold transition-transform hover:scale-[1.02] ${
                  plan.featured
                    ? "bg-marketing-accent text-marketing-charcoal"
                    : "bg-marketing-charcoal text-marketing-cream"
                }`}
              >
                {plan.cta} <ArrowRight className="h-4 w-4" />
              </AnalyticsLink>
            </article>
          ))}
        </div>

        <p className={`mx-auto mt-10 max-w-2xl text-center text-sm text-marketing-charcoal/50 ${typo.secondarySans}`}>
          Already have an account?{" "}
          <AnalyticsLink
            href={PRODUCT_LINKS.ucatLogin}
            analytics={{ product: "ucat", placement: "pricing", action: "login" }}
            className="font-medium text-marketing-primary underline-offset-2 hover:underline"
          >
            Log in
          </AnalyticsLink>{" "}
          to manage or change your plan.
        </p>
      </div>
    </section>
  );
}
