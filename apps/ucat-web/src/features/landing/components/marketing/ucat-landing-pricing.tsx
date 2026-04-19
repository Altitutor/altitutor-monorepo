"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { Check, Unlock } from "lucide-react";
import Link from "next/link";
import { MagneticButton } from "./magnetic-button";
import { getTrialBookingUrl } from "../../lib/trial-booking-url";

const { typography: typo } = MARKETING_TOKENS;

export function UcatLandingPricing() {
  return (
    <section
      id="pricing"
      className="relative flex min-h-screen w-full flex-col justify-center overflow-hidden bg-marketing-cream py-40"
    >
      <div className="mx-auto max-w-7xl px-8">
        <div className="mb-24 text-center">
          <h2
            className={`text-5xl font-bold tracking-tight text-marketing-charcoal md:text-7xl ${typo.headingSans}`}
          >
            Accountability Pricing
          </h2>
          <p
            className={`mx-auto mt-6 max-w-2xl text-xl text-marketing-charcoal/60 ${typo.secondarySans}`}
          >
            We don&apos;t want your money; we want your dedication. Consistency
            lowers your cost. Slacking off increases it.
          </p>
        </div>

        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-stretch gap-8 md:grid-cols-3">
          <div className="relative flex flex-col justify-between overflow-hidden rounded-[3rem] bg-white p-8 shadow-xl ring-1 ring-black/5 transition-all duration-500 hover:ring-marketing-primary/20 md:p-10">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-marketing-primary opacity-10 blur-xl" />
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Check className="h-5 w-5 text-marketing-primary" />
                <span
                  className={`text-xs font-bold uppercase tracking-widest text-marketing-primary ${typo.headingSans}`}
                >
                  Accountability
                </span>
              </div>
              <h3
                className={`mb-4 text-3xl font-bold text-marketing-charcoal ${typo.headingSans}`}
              >
                Online Access
              </h3>
              <p
                className={`mb-8 text-base text-marketing-charcoal/70 ${typo.secondarySans}`}
              >
                Complete your assigned modules every week and the platform is
                practically free. Slack off, and the accountability fee triggers
                to fund our non-profit mission.
              </p>
              <div className="mb-2 flex items-end gap-3">
                <div
                  className={`text-5xl font-bold text-marketing-charcoal ${typo.headingSans}`}
                >
                  $9
                  <span className="text-xl font-normal text-marketing-charcoal/40">
                    /mo
                  </span>
                </div>
                <div
                  className={`pb-1 text-2xl font-bold text-marketing-charcoal/30 line-through ${typo.headingSans}`}
                >
                  $149
                </div>
              </div>
              <p
                className={`text-xs font-medium text-marketing-primary ${typo.dataMono}`}
              >
                $9/mo standard • $149/mo penalty
              </p>
            </div>
            <Link href="/subscribe">
              <MagneticButton className="mt-12 w-full bg-marketing-primary py-4 text-base font-semibold text-marketing-cream hover:shadow-lg">
                Commit Now
              </MagneticButton>
            </Link>
          </div>

          <div className="group relative flex flex-col justify-between overflow-hidden rounded-[3rem] bg-marketing-charcoal p-8 shadow-2xl md:p-10">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-marketing-accent opacity-20 blur-xl transition-transform duration-1000 group-hover:scale-150" />
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Unlock className="h-5 w-5 text-marketing-accent" />
                <span
                  className={`text-xs font-bold uppercase tracking-widest text-marketing-accent ${typo.headingSans}`}
                >
                  Premium
                </span>
              </div>
              <h3
                className={`mb-4 text-3xl font-bold text-marketing-cream ${typo.headingSans}`}
              >
                In Person
              </h3>
              <p
                className={`mb-8 text-base text-marketing-cream/70 ${typo.secondarySans}`}
              >
                Weekly in-person classes to intensely refine your skills with
                expert tutors. Includes full unrestricted access to the online
                platform for free.
              </p>
              <div
                className={`mb-2 text-5xl font-bold text-marketing-cream ${typo.headingSans}`}
              >
                $50
                <span className="text-xl font-normal text-marketing-cream/40">
                  /wk
                </span>
              </div>
              <p
                className={`text-xs font-medium text-marketing-cream/40 ${typo.dataMono}`}
              >
                Limited seats available
              </p>
            </div>
            <Link href={getTrialBookingUrl()}>
              <MagneticButton className="mt-12 w-full bg-marketing-accent py-4 text-base font-semibold text-marketing-charcoal shadow-lg shadow-marketing-accent/20">
                Book Trial Session
              </MagneticButton>
            </Link>
          </div>

          <div className="relative flex flex-col justify-between overflow-hidden rounded-[3rem] border border-black/5 bg-white/50 p-8 shadow-sm md:p-10">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-marketing-charcoal opacity-30" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-marketing-charcoal/50" />
                </span>
                <span
                  className={`text-xs font-bold uppercase tracking-widest text-marketing-charcoal/50 ${typo.headingSans}`}
                >
                  Coming Soon
                </span>
              </div>
              <h3
                className={`mb-4 text-3xl font-bold text-marketing-charcoal/70 ${typo.headingSans}`}
              >
                Online Classes
              </h3>
              <p
                className={`mb-8 text-base text-marketing-charcoal/60 ${typo.secondarySans}`}
              >
                Includes a comprehensive 1-on-1 initial assessment, followed by
                a dedicated video lesson with a tutor once a month to track
                trajectory.
              </p>
              <div
                className={`mb-2 text-5xl font-bold text-marketing-charcoal/50 ${typo.headingSans}`}
              >
                $50
                <span className="text-xl font-normal text-marketing-charcoal/30">
                  /wk
                </span>
              </div>
              <p
                className={`text-xs font-medium text-marketing-charcoal/40 ${typo.dataMono}`}
              >
                Waitlist opening soon
              </p>
            </div>
            <button
              type="button"
              disabled
              className="mt-12 w-full cursor-not-allowed rounded-full bg-black/5 py-4 text-base font-semibold text-marketing-charcoal/40"
            >
              Join Waitlist
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
