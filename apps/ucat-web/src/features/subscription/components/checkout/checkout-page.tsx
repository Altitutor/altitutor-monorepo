"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  LockKeyhole,
  Mail,
  Sparkles,
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { CheckoutProvider } from "@stripe/react-stripe-js/checkout";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { createUcatCheckoutSession } from "@/features/subscription/api/create-checkout";
import { usePublicSubscriptionConfig } from "@/features/subscription/hooks/use-public-subscription-config";
import { trackSubscriptionJourneyEvent } from "@/features/subscription/api/track-subscription-journey";
import { formatMoneyFromMinorUnits } from "@/features/subscription/lib/format-subscription-copy";
import { computeMarketingPlanPricing } from "@/features/subscription/lib/marketing-plan-pricing";
import {
  defaultPublicSubscriptionConfig,
  getPublicPlanPrice,
  getPublicPracticeDayDiscount,
  isPlanCheckoutAvailable,
} from "@/features/subscription/types/public-subscription-config";
import { CheckoutPaymentForm } from "@/features/subscription/components/checkout/checkout-payment-form";
import {
  isUcatBillingInterval,
  isUcatPaidPlanTier,
  type UcatBillingInterval,
} from "@altitutor/shared";

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = stripeKey ? loadStripe(stripeKey) : Promise.resolve(null);

const UNLIMITED_FEATURES = [
  "Unlimited practice across every UCAT section",
  "Full-length mock exams and percentile tracking",
  "Adaptive skill trainer and progress analytics",
] as const;

const PRO_FEATURES = [
  ...UNLIMITED_FEATURES,
  "Monthly online workshop and 1-1 performance review",
  "On-demand help from Altitutor tutors",
] as const;

type JourneyContext = "signup_onboarding" | "subscribe" | "practice_session";

function isJourneyContext(value: string | null): value is JourneyContext {
  return (
    value === "signup_onboarding" ||
    value === "subscribe" ||
    value === "practice_session"
  );
}

function intervalNoun(interval: UcatBillingInterval) {
  return interval === "week" ? "week" : interval === "month" ? "month" : "year";
}

function CheckoutFieldsSkeleton() {
  return (
    <div
      className="animate-pulse space-y-5"
      aria-label="Loading payment fields"
    >
      <div className="h-4 w-20 rounded bg-muted" />
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-12 rounded-xl bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-12 rounded-xl bg-muted" />
        <div className="h-12 rounded-xl bg-muted" />
      </div>
      <div className="h-12 rounded-xl bg-muted" />
      <div className="h-10 w-4/5 rounded bg-muted/70" />
    </div>
  );
}

export function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resolvedTheme } = useTheme();
  const tierParam = searchParams.get("tier");
  const intervalParam = searchParams.get("interval");
  const contextParam = searchParams.get("context");
  const tier = isUcatPaidPlanTier(tierParam) ? tierParam : null;
  const interval = isUcatBillingInterval(intervalParam) ? intervalParam : null;
  const context = isJourneyContext(contextParam) ? contextParam : "subscribe";
  const {
    data: config = defaultPublicSubscriptionConfig,
    isPending: configLoading,
  } = usePublicSubscriptionConfig();
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(
    null,
  );
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [sessionTrial, setSessionTrial] = useState({
    eligible: false,
    days: 0,
  });
  const sessionStartedRef = useRef(false);

  useEffect(() => {
    if (!tier || !interval) {
      router.replace("/subscribe");
      return;
    }
    if (sessionStartedRef.current) return;
    sessionStartedRef.current = true;
    void createUcatCheckoutSession({ tier, interval, returnContext: context })
      .then((session) => {
        setCheckoutSessionId(session.checkoutSessionId);
        setClientSecret(session.clientSecret);
        setSessionTrial({
          eligible: session.trialEligible,
          days: session.trialDays,
        });
      })
      .catch((error: unknown) => {
        setCheckoutError(
          error instanceof Error
            ? error.message
            : "Checkout could not be loaded",
        );
      });
  }, [context, interval, router, tier]);

  if (!tier || !interval) {
    return null;
  }

  const price = getPublicPlanPrice(config, tier, interval);
  const discount = getPublicPracticeDayDiscount(config, interval);
  const checkoutAvailable = isPlanCheckoutAvailable(config, tier, interval);
  const pricing =
    price && discount
      ? computeMarketingPlanPricing(
          price.basePriceCents,
          interval,
          discount.discountPerDayCents,
          discount.maxDiscountsPerPeriod,
        )
      : null;
  const trialEligible = sessionTrial.eligible && sessionTrial.days > 0;
  const trialDays = sessionTrial.days;
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + trialDays);
  const reminderDate = new Date();
  reminderDate.setDate(reminderDate.getDate() + Math.max(1, trialDays - 3));
  const features = tier === "pro" ? PRO_FEATURES : UNLIMITED_FEATURES;

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <button
          type="button"
          onClick={() => {
            trackSubscriptionJourneyEvent({
              eventType: "change_plan_clicked",
              journeyContext: context,
              planTier: tier,
              billingInterval: interval,
              checkoutSessionId: checkoutSessionId ?? undefined,
            });
            if (context === "signup_onboarding") {
              router.push("/signup/complete");
            } else if (window.history.length > 1) {
              router.back();
            } else {
              router.push("/subscribe");
            }
          }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.86fr)] lg:items-start">
          <section>
            <span className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
              Complete your subscription
            </span>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
              Pay securely
            </h1>
            <p className="mt-2 text-muted-foreground">
              Your payment details are collected and processed by Stripe.
            </p>
            <div className="mt-7">
              {!stripeKey ? (
                <p className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-200">
                  Stripe checkout is not configured in this environment.
                </p>
              ) : checkoutError ? (
                <p className="rounded-xl bg-red-500/10 p-4 text-sm text-red-200">
                  {checkoutError}
                </p>
              ) : clientSecret ? (
                <CheckoutProvider
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    elementsOptions: {
                      appearance: {
                        theme: resolvedTheme === "light" ? "stripe" : "night",
                        variables: {
                          colorPrimary: "#91b4c5",
                          colorBackground:
                            resolvedTheme === "light" ? "#ffffff" : "#262626",
                          colorText:
                            resolvedTheme === "light" ? "#072348" : "#ffffff",
                          colorDanger: "#dc2626",
                          colorTextSecondary:
                            resolvedTheme === "light" ? "#36516f" : "#b3b3b3",
                          borderRadius: "16px",
                          fontFamily:
                            "Inter, ui-sans-serif, system-ui, sans-serif",
                        },
                        rules: {
                          ".AccordionItem": {
                            backgroundColor: "transparent",
                            border: "1px solid transparent",
                            boxShadow: "none",
                            padding: "0",
                          },
                          ".Input": {
                            backgroundColor:
                              resolvedTheme === "light" ? "#ffffff" : "#262626",
                            borderColor:
                              resolvedTheme === "light" ? "#dfe1e5" : "#3d3d3d",
                            boxShadow: "none",
                            padding: "14px",
                          },
                          ".Input:focus": {
                            borderColor: "#91b4c5",
                            boxShadow: "0 0 0 2px rgba(145, 180, 197, 0.18)",
                          },
                          ".Label": { fontWeight: "500" },
                        },
                      },
                    },
                  }}
                >
                  <CheckoutPaymentForm
                    tier={tier}
                    interval={interval}
                    context={context}
                    checkoutSessionId={checkoutSessionId}
                    onSubmittingChange={setCheckoutSubmitting}
                  />
                </CheckoutProvider>
              ) : (
                <CheckoutFieldsSkeleton />
              )}
            </div>
          </section>

          <aside className="rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-2xl sm:p-8 lg:sticky lg:top-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Selected plan
                </p>
                <h2 className="mt-1 text-2xl font-bold">
                  UCAT {tier === "pro" ? "Pro" : "Unlimited"}
                </h2>
              </div>
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <ul className="mt-6 space-y-3 text-sm">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="my-6 h-px bg-border" />

            {pricing ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    Standard {intervalNoun(interval)}ly price
                  </span>
                  <span className="font-semibold">
                    {formatMoneyFromMinorUnits(
                      pricing.standardPeriodCents,
                      config.currency,
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    Maximum practice discount
                  </span>
                  <span className="font-semibold text-primary">
                    −
                    {formatMoneyFromMinorUnits(
                      pricing.standardPeriodCents - pricing.idealPeriodCents,
                      config.currency,
                    )}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Answer {config.minQuestionsPerDay}+ questions in a day and
                  earn{" "}
                  {formatMoneyFromMinorUnits(
                    discount?.discountPerDayCents ?? 0,
                    config.currency,
                  )}{" "}
                  off, up to {discount?.maxDiscountsPerPeriod ?? 0} times per{" "}
                  {intervalNoun(interval)}.
                </p>
                <div className="flex justify-between gap-4 border-t border-border pt-3">
                  <span className="font-medium">
                    Discounted {intervalNoun(interval)}ly price
                  </span>
                  <span className="font-semibold">
                    {formatMoneyFromMinorUnits(
                      pricing.idealPeriodCents,
                      config.currency,
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Due today</span>
                  <span className="font-semibold">
                    {trialEligible
                      ? formatMoneyFromMinorUnits(0, config.currency)
                      : formatMoneyFromMinorUnits(
                          pricing.standardPeriodCents,
                          config.currency,
                        )}
                  </span>
                </div>
              </div>
            ) : null}

            {trialEligible ? (
              <div className="mt-6">
                <p className="text-lg font-semibold">
                  Your {trialDays}-day trial
                </p>
                <ol className="mt-4 space-y-3 text-sm">
                  <li>
                    <div className="rounded-2xl border border-primary/40 bg-primary/[0.08] p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                            <Sparkles className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <p className="font-semibold">Access unlocked</p>
                        </div>
                        <span className="shrink-0 pt-0.5 text-xs font-bold uppercase tracking-wide text-primary">
                          Today
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        Get full access to the entire UCAT system — including
                        unlimited questions, sets and mocks. Start earning
                        discounts towards your first bill from today.
                      </p>
                    </div>
                  </li>
                  <li>
                    <div className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
                            <Mail className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <p className="font-semibold">Reminder emailed</p>
                        </div>
                        <time
                          dateTime={reminderDate.toISOString()}
                          className="shrink-0 pt-0.5 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                        >
                          {reminderDate.toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                          })}
                        </time>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        We’ll remind you that you’ll be charged at the end of
                        your free trial.
                      </p>
                    </div>
                  </li>
                  <li>
                    <div className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
                            <CalendarCheck
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          </span>
                          <p className="font-semibold">Paid plan begins</p>
                        </div>
                        <time
                          dateTime={trialEnd.toISOString()}
                          className="shrink-0 pt-0.5 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                        >
                          {trialEnd.toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                          })}
                        </time>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        You’ll be charged the {intervalNoun(interval)}ly price,
                        minus any discount you earned during the trial.
                      </p>
                    </div>
                  </li>
                </ol>
                {tier === "pro" ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Pro workshops, tutor help, and performance reviews begin
                    with the paid subscription.
                  </p>
                ) : null}
              </div>
            ) : null}

            {!checkoutAvailable && price ? (
              <p className="mt-5 text-sm text-red-700">
                This plan is currently unavailable for new checkout.
              </p>
            ) : null}

            <Button
              type="submit"
              form="ucat-checkout-payment-form"
              disabled={
                configLoading ||
                !clientSecret ||
                Boolean(checkoutError) ||
                checkoutSubmitting
              }
              className="mt-6 h-14 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {checkoutSubmitting
                ? "Confirming…"
                : trialEligible
                  ? `Start my ${trialDays}-day trial`
                  : `Subscribe to UCAT ${tier === "pro" ? "Pro" : "Unlimited"}`}
              {!checkoutSubmitting ? (
                <ArrowRight className="ml-2 h-4 w-4" />
              ) : null}
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <LockKeyhole className="h-3.5 w-3.5 shrink-0" /> Cancel anytime.
              Payment details are securely processed by Stripe.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
