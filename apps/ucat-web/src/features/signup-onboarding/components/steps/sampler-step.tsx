"use client";

import { useRouter } from "next/navigation";
import { Button } from "@altitutor/ui";
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
    description: "Show me each essential control as I answer.",
    Icon: GraduationCap,
  },
  {
    value: "familiar",
    title: "I know the UCAT format",
    description: "Give me short prompts for the controls that matter.",
    Icon: BookOpenCheck,
  },
  {
    value: "experienced",
    title: "I’m already practising",
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
        <div className="flex flex-col gap-4 rounded-2xl border border-marketing-accent/25 bg-marketing-accent/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-marketing-accent text-marketing-charcoal">
              <Gift className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="font-semibold text-marketing-cream">
                Your gift from {gift.referrerName} is ready
              </p>
              <p className="mt-1 text-sm text-marketing-cream/60">
                Preview the UCAT experience first, or accept your free{" "}
                {gift.duration} now.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-marketing-accent/40 bg-transparent text-marketing-cream hover:bg-marketing-accent/10 hover:text-marketing-cream"
            onClick={acceptGift}
          >
            Accept gift now
          </Button>
        </div>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-marketing-cream">
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
                    ? "border-marketing-accent bg-marketing-accent/[0.12]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    selected
                      ? "text-marketing-accent"
                      : "text-marketing-cream/50",
                  )}
                  aria-hidden
                />
                <span className="mt-4 block font-semibold text-marketing-cream">
                  {title}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-marketing-cream/55">
                  {description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-marketing-cream/50">
          This sampler is not scored and does not use your practice quota.
        </p>
        <Button
          type="button"
          disabled={!familiarity}
          onClick={() =>
            router.push(
              `/signup/complete/sampler?familiarity=${familiarity ?? "new"}`,
            )
          }
          className="bg-marketing-accent text-marketing-charcoal hover:bg-marketing-accent/90"
        >
          Start the guided sampler
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
