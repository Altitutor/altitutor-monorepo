"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import Link from "next/link";

const { typography: typo } = MARKETING_TOKENS;

export function UcatLandingFooter() {
  return (
    <footer className="relative z-30 w-full rounded-t-[4rem] bg-marketing-charcoal px-8 pb-10 pt-20 text-marketing-cream">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-12 border-b border-white/10 pb-12 md:flex-row md:items-end">
        <div className="max-w-sm">
          <h2 className={`mb-4 text-3xl font-bold tracking-tight ${typo.headingSans}`}>
            Alti UCAT
          </h2>
          <p className={`leading-relaxed text-marketing-cream/60 ${typo.secondarySans}`}>
            Precision medical entry preparation powered by adaptive baseline
            tracking. A non-profit initiative by Altitutor.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-left md:text-right">
          <a
            href="#methodology"
            className={`text-marketing-cream/80 transition-colors hover:text-white ${typo.secondarySans}`}
          >
            Methodology
          </a>
          <a
            href="#pricing"
            className={`text-marketing-cream/80 transition-colors hover:text-white ${typo.secondarySans}`}
          >
            Pricing Policy
          </a>
          <Link
            href="/login"
            className={`text-marketing-cream/80 transition-colors hover:text-white ${typo.secondarySans}`}
          >
            Sign In
          </Link>
        </div>
      </div>
      <div className="mx-auto mt-8 flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-marketing-primary opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-marketing-accent" />
          </span>
          <span
            className={`text-xs uppercase tracking-widest text-marketing-cream/40 ${typo.dataMono}`}
          >
            System Operational
          </span>
        </div>
        <p className={`text-sm text-marketing-cream/40 ${typo.secondarySans}`}>
          &copy; {new Date().getFullYear()} Altitutor. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
