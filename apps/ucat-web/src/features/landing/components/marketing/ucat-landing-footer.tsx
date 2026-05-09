"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";
import Link from "next/link";

const { typography: typo } = MARKETING_TOKENS;

export function UcatLandingFooter() {
  return (
    <footer className="relative z-30 w-full overflow-hidden rounded-t-[4rem] bg-marketing-charcoal px-8 pb-16 pt-32 text-marketing-cream shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-[400px] w-[800px] -translate-x-1/2 translate-y-1/2 rounded-[100%] bg-marketing-primary/50 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-12 border-b border-white/10 pb-16 md:grid-cols-4 md:gap-8">
          <div className="col-span-1 md:col-span-2">
            <h2 className={`text-3xl font-bold tracking-tight ${typo.headingSans}`}>
              Alti UCAT
            </h2>
            <p className={`mt-4 max-w-sm text-marketing-cream/60 ${typo.secondarySans}`}>
              Precision medical entry preparation powered by adaptive baseline
              tracking. A non-profit initiative by Altitutor.
            </p>
          </div>

          <div>
            <h3
              className={`mb-6 text-sm font-semibold uppercase tracking-wider text-marketing-accent ${typo.dataMono}`}
            >
              Platform
            </h3>
            <ul className={`space-y-4 text-marketing-cream/80 ${typo.secondarySans}`}>
              <li>
                <Link href="/login" className="transition-colors hover:text-white">
                  Portal Login
                </Link>
              </li>
              <li>
                <Link
                  href="https://altitutor.com"
                  className="transition-colors hover:text-white"
                >
                  Main Website
                </Link>
              </li>
              <li>
                <Link
                  href="https://student.altitutor.com"
                  className="transition-colors hover:text-white"
                >
                  Student Portal
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3
              className={`mb-6 text-sm font-semibold uppercase tracking-wider text-marketing-accent ${typo.dataMono}`}
            >
              Social
            </h3>
            <div className="flex gap-4">
              <a
                href="https://www.instagram.com/altitutor/"
                target="_blank"
                rel="noreferrer"
                className="text-marketing-cream/60 transition-colors hover:-translate-y-1 hover:text-white"
              >
                <Instagram className="h-6 w-6" />
              </a>
              <a
                href="https://www.facebook.com/altitutoreducation/"
                target="_blank"
                rel="noreferrer"
                className="text-marketing-cream/60 transition-colors hover:-translate-y-1 hover:text-white"
              >
                <Facebook className="h-6 w-6" />
              </a>
              <a
                href="https://twitter.com/Altitutor"
                target="_blank"
                rel="noreferrer"
                className="text-marketing-cream/60 transition-colors hover:-translate-y-1 hover:text-white"
              >
                <Twitter className="h-6 w-6" />
              </a>
              <a
                href="https://www.youtube.com/@altitutor"
                target="_blank"
                rel="noreferrer"
                className="text-marketing-cream/60 transition-colors hover:-translate-y-1 hover:text-white"
              >
                <Youtube className="h-6 w-6" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 md:flex-row">
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
      </div>
    </footer>
  );
}
