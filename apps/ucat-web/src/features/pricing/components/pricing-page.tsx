"use client";

import Link from "next/link";
import { Button } from "@altitutor/ui";
import { MarketingHeader } from "@/features/landing";
import { useAuth } from "@/features/auth";
import { Check } from "lucide-react";

const features = [
  "Full access to practice sets and mocks",
  "Progress tracking and analytics",
  "7-day free trial",
  "Weekly billing – cancel anytime",
  "Earn $10 off for every 20 questions you complete in a day",
];

export function PricingPage() {
  const { user } = useAuth();
  return (
    <div className="min-h-dvh bg-background">
      <MarketingHeader />
      <main className="pt-20">
        <section className="mx-auto max-w-2xl px-4 py-16">
          <h1 className="text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            UCAT Online Platform
          </h1>
          <p className="mt-4 text-center text-muted-foreground">
            Get full access to the UCAT online platform with practice sets,
            mocks, and progress tracking.
          </p>

          <div className="mt-10 rounded-xl border border-border bg-card p-8 shadow-sm transition-shadow duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-md">
            <h2 className="text-xl font-semibold text-foreground">
              What&apos;s included
            </h2>
            <ul className="mt-6 space-y-4">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-4">
              {user ? (
                <Button size="lg" className="w-full" asChild>
                  <Link href="/subscribe">Subscribe now</Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" className="w-full" asChild>
                    <Link href="/signup?redirect=/subscribe">Get started</Link>
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link
                      href="/login?redirect=/subscribe"
                      className="underline transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-foreground"
                    >
                      Log in
                    </Link>
                  </p>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
