"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  Gift,
  GraduationCap,
} from "lucide-react";
import type { PendingReferralGift } from "@/features/subscription/api/referral-gifts";
import { cn } from "@/lib/utils";

export type UcatFamiliarity = "new" | "familiar" | "experienced";

const OPTIONS: Array<{
  value: UcatFamiliarity;
  title: string;
  description: string;
  Icon: typeof GraduationCap;
}> = [
  {
    value: "new",
    title: "I’m completely new",
    description: "Coach me through the method and controls step by step.",
    Icon: GraduationCap,
  },
  {
    value: "familiar",
    title: "I know the UCAT format",
    description: "Give me the guided walkthrough as I try the real controls.",
    Icon: BookOpenCheck,
  },
  {
    value: "experienced",
    title: "I’m already practicing",
    description: "Keep guidance minimal and let me skip if I want.",
    Icon: BrainCircuit,
  },
];

type SignupCompleteSamplerStepProps = {
  familiarity: UcatFamiliarity | null;
  onFamiliarityChange: (value: UcatFamiliarity) => void;
  gift: PendingReferralGift | null;
};

export function SignupCompleteSamplerStep({
  familiarity,
  onFamiliarityChange,
  gift,
}: SignupCompleteSamplerStepProps) {
  const router = useRouter();

  function acceptGift() {
    if (!gift) return;
    const interval = gift.duration === "month" ? "month" : "week";
    const params = new URLSearchParams({
      tier: "unlimited",
      interval,
      context: "signup_onboarding",
      gift: gift.id,
    });
    router.push(`/checkout?${params.toString()}`);
  }

  return (
    <div className="space-y-5">
      {gift ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/[0.06] p-4 dark:border-accent/25 dark:bg-accent/[0.08] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground dark:bg-accent dark:text-primary-foreground">
              <Gift className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="font-semibold text-foreground">
                Your gift from {gift.referrerName} is ready
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Preview the UCAT experience first, or accept your free{" "}
                {gift.duration} now.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-primary/30 bg-transparent text-foreground hover:bg-primary/10 hover:text-foreground dark:border-accent/40 dark:hover:bg-accent/10"
            onClick={acceptGift}
          >
            Accept gift now
          </Button>
        </div>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">
          How familiar are you with UCAT practice?
        </legend>
        <div className="grid gap-3 md:grid-cols-3">
          {OPTIONS.map(({ value, title, description, Icon }) => {
            const selected = familiarity === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => onFamiliarityChange(value)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-colors",
                  selected
                    ? "border-foreground/20 bg-muted ring-1 ring-foreground/15"
                    : "border-border bg-card hover:border-foreground/20 hover:bg-muted/60",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    selected ? "text-foreground" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                <span className="mt-4 block font-semibold text-foreground">
                  {title}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                  {description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={!familiarity}
          onClick={() =>
            router.push(
              `/signup/complete/sampler?familiarity=${familiarity ?? "new"}`,
            )
          }
        >
          Start sample questions
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
