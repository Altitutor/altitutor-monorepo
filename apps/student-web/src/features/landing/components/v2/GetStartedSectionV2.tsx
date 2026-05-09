"use client";

import React from "react";
import { TOKENS, MagneticButton } from "./shared";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function GetStartedSectionV2() {
  return (
    <section
      id="ecosystem"
      className="relative w-full bg-[#F2F0E9] py-40 overflow-hidden min-h-dvh flex flex-col justify-center"
    >
      <div className="mx-auto max-w-7xl px-8 relative z-10">
        <div className="text-center mb-24">
          <h2
            className={`text-5xl md:text-7xl font-bold tracking-tight text-[#1A1A1A] ${TOKENS.typography.headingSans}`}
          >
            Become part of the Ecosystem
          </h2>
          <p
            className={`mt-6 text-xl text-[#1A1A1A]/60 max-w-2xl mx-auto ${TOKENS.typography.secondarySans}`}
          >
            A vibrant hub where academics blend with fun and friendship. Engage, connect, and grow in an environment that values personal development.
          </p>
        </div>

        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-stretch gap-8 md:grid-cols-3">
          <div className="relative flex flex-col justify-between overflow-hidden rounded-[3rem] bg-white p-8 shadow-xl ring-1 ring-black/5 transition-all duration-500 hover:ring-[#0a2941]/20 md:p-10">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-[#0a2941] opacity-10 blur-xl" />
            <div>
              <span className={`text-xs font-bold uppercase tracking-widest text-[#0a2941] ${TOKENS.typography.headingSans}`}>
                Current Student
              </span>
              <h3 className={`mt-4 text-3xl font-bold text-[#1A1A1A] ${TOKENS.typography.headingSans}`}>
                Log in to the Portal
              </h3>
              <p className={`mt-4 text-lg text-[#1A1A1A]/70 ${TOKENS.typography.secondarySans} max-w-xl`}>
                Already an Altitutor student? Access your learning modules, homework help, Alti events calendar, and live question boards inside the Student portal.
              </p>
            </div>
            <Link href="/login" className="mt-12 w-full md:w-auto">
              <MagneticButton className="bg-[#0a2941] w-full md:w-auto px-8 py-4 text-sm font-medium tracking-wide text-[#F2F0E9]">
                Enter System <ArrowRight className="h-4 w-4" />
              </MagneticButton>
            </Link>
          </div>

          <div className="relative flex flex-col justify-between overflow-hidden rounded-[3rem] bg-[#1A1A1A] p-8 shadow-2xl md:p-10">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-[#92b9c6] opacity-20 blur-xl transition-transform duration-1000 hover:scale-150" />
            <div>
              <span className={`text-xs font-bold uppercase tracking-widest text-[#92b9c6] ${TOKENS.typography.headingSans}`}>
                NEW STUDENT
              </span>
              <h3 className={`mt-4 text-3xl font-bold text-[#F2F0E9] ${TOKENS.typography.headingSans}`}>
                Not enrolled?
              </h3>
              <p className={`mt-4 text-lg text-[#F2F0E9]/70 ${TOKENS.typography.secondarySans}`}>
                Book a free trial and consultation to experience our organic learning ecosystem firsthand.
              </p>
            </div>
            <Link href="https://altitutor.com/register" className="mt-12 w-full">
              <MagneticButton className="bg-[#92b9c6] w-full px-8 py-4 text-sm font-medium tracking-wide text-[#1A1A1A] shadow-lg shadow-[#92b9c6]/20">
                Register Free Trial
              </MagneticButton>
            </Link>
          </div>

          <div className="relative flex flex-col justify-between overflow-hidden rounded-[3rem] border border-black/5 bg-white/50 p-8 shadow-sm md:p-10">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1A1A1A] opacity-30" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1A1A1A]/50" />
                </span>
                <span className={`text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/50 ${TOKENS.typography.headingSans}`}>
                  Coming Soon
                </span>
              </div>
              <h3 className={`mb-4 text-3xl font-bold text-[#1A1A1A]/70 ${TOKENS.typography.headingSans}`}>
                Online Access
              </h3>
              <p className={`mb-8 text-base text-[#1A1A1A]/60 ${TOKENS.typography.secondarySans}`}>
                Dedicated online access track with monthly tutor check-ins and structured module accountability.
              </p>
              <p className={`text-xs font-medium text-[#1A1A1A]/40 ${TOKENS.typography.dataMono}`}>
                Waitlist opening soon
              </p>
            </div>
            <button
              type="button"
              disabled
              className="mt-12 w-full cursor-not-allowed rounded-full bg-black/5 py-4 text-base font-semibold text-[#1A1A1A]/40"
            >
              Join Waitlist
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
