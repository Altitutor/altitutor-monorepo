"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  MARKETING_BODY_DESCRIPTION_CLASS,
  MARKETING_SECTION_HEADING_CLASS,
} from "@/features/marketing/section-styles";
import { UcatInterestForm } from "./ucat-interest-form";

import { MARKETING_TYPOGRAPHY as typo } from "@/features/marketing/theme";

function ClientOnly({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted ? children : fallback;
}

export function MedicalInterviewWaitlistSection() {
  return (
    <section
      id="get-started"
      className="relative z-10 bg-marketing-cream px-4 py-16 sm:px-8 sm:py-20"
    >
      <div className="mx-auto max-w-xl">
        <h2 className={`${MARKETING_SECTION_HEADING_CLASS} ${typo.headingSans}`}>
          How to get started
        </h2>
        <p
          className={`mt-5 ${MARKETING_BODY_DESCRIPTION_CLASS} ${typo.secondarySans}`}
        >
          Join the waitlist and we will contact you to schedule a trial session.
        </p>
        <div className="mt-8">
          <ClientOnly fallback={<div className="min-h-[24rem]" aria-hidden />}>
            <UcatInterestForm
              kind="interview_training_waitlist"
              successBody="Thank you. We will contact you to schedule a trial session."
            />
          </ClientOnly>
        </div>
      </div>
    </section>
  );
}
