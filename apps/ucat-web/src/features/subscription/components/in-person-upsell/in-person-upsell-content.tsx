"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { MagneticButton } from "@/features/landing/components/marketing/magnetic-button";
import { getTrialBookingUrl } from "@/features/landing/lib/trial-booking-url";
import { PlanPickerCheckIcon } from "@/features/subscription/components/plan-picker/plan-picker-check-icon";

const { typography: typo } = MARKETING_TOKENS;

const IN_PERSON_FEATURES = [
  "Everything in online plans",
  "Weekly in-person sessions",
  "Expert UCAT tutors",
  "Initial 1-on-1 diagnostic assessment",
  "Book a free trial session to get started",
] as const;

type InPersonUpsellContentProps = {
  className?: string;
};

export function InPersonUpsellContent({ className }: InPersonUpsellContentProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[2.5rem] bg-marketing-charcoal p-8 shadow-lg md:p-10 ${className ?? ""}`}
    >
      <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-full bg-marketing-accent/10 blur-2xl" />
      <div>
        <span
          className={`text-xs font-bold uppercase tracking-widest text-marketing-accent ${typo.dataMono}`}
        >
          Premium
        </span>
        <h3
          className={`mt-3 text-2xl font-bold text-marketing-cream ${typo.headingSans}`}
        >
          In person
        </h3>
        <p
          className={`mt-3 text-sm text-marketing-cream/60 ${typo.secondarySans}`}
        >
          Weekly in-person classes with expert tutors. Includes full unrestricted
          online access at no extra cost.
        </p>

        <div className="mt-6 space-y-1">
          <div className="flex items-end gap-2">
            <span
              className={`text-4xl font-bold text-marketing-cream ${typo.headingSans}`}
            >
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
          {IN_PERSON_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2 text-marketing-accent">
              <PlanPickerCheckIcon />
              <span className="text-marketing-cream/70">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <a
        href={getTrialBookingUrl()}
        target="_blank"
        rel="noreferrer"
        className="mt-10 block"
      >
        <MagneticButton
          className={`w-full bg-marketing-accent py-4 text-base font-semibold text-marketing-charcoal shadow-lg shadow-marketing-accent/20 ${typo.headingSans}`}
        >
          Book trial session
        </MagneticButton>
      </a>
    </div>
  );
}
