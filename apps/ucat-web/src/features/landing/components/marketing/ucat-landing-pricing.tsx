"use client";

import Link from "next/link";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { PlanPicker } from "@/features/subscription/components/plan-picker/plan-picker";

const { typography: typo } = MARKETING_TOKENS;

export function UcatLandingPricing() {
  return (
    <section
      id="pricing"
      className="relative flex min-h-dvh w-full flex-col justify-center overflow-hidden bg-marketing-cream py-24 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mb-16 text-center">
          <h2
            className={`text-4xl font-bold tracking-tight text-marketing-charcoal sm:text-5xl md:text-6xl ${typo.headingSans}`}
          >
            Choose your plan
          </h2>
          <p
            className={`mx-auto mt-6 max-w-2xl text-lg text-marketing-charcoal/60 ${typo.secondarySans}`}
          >
            Start free, then upgrade when you&apos;re ready. Accountability
            pricing rewards consistent daily practice.
          </p>
        </div>

        <PlanPicker
          variant="page"
          selectorTheme="light"
          audience="marketing"
        />

        <p
          className={`mx-auto mt-10 max-w-2xl text-center text-sm text-marketing-charcoal/50 ${typo.secondarySans}`}
        >
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-marketing-primary underline-offset-2 hover:underline">
            Log in
          </Link>{" "}
          to manage your plan or start a trial.
        </p>
      </div>
    </section>
  );
}
