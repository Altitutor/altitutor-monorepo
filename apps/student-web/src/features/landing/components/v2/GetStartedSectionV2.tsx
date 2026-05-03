"use client";

import React from "react";
import { TOKENS, MagneticButton } from "./shared";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function GetStartedSectionV2() {
  return (
    <section
      id="community"
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Join Portal */}
          <div className="flex flex-col items-start justify-between rounded-[2rem] bg-white p-10 ring-1 ring-black/5 shadow-xl transition-transform hover:-translate-y-2 lg:col-span-2">
            <div>
              <h3 className={`text-3xl font-bold text-[#1A1A1A] ${TOKENS.typography.headingSans}`}>
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

          {/* New to Alti? */}
          <div className="flex flex-col items-start justify-between rounded-[2rem] bg-[#92b9c6] p-10 shadow-xl transition-transform hover:-translate-y-2">
            <div>
              <span className={`px-3 py-1 bg-[#1A1A1A]/10 rounded-full text-sm font-semibold mb-6 inline-block text-[#1A1A1A] ${TOKENS.typography.dataMono}`}>
                NEW STUDENT
              </span>
              <h3 className={`text-3xl font-bold text-[#1A1A1A] ${TOKENS.typography.headingSans}`}>
                Not enrolled?
              </h3>
              <p className={`mt-4 text-lg text-[#1A1A1A]/80 ${TOKENS.typography.secondarySans}`}>
                Book a free trial and consultation to experience our organic learning ecosystem firsthand.
              </p>
            </div>
            <Link href="https://altitutor.com/register" className="mt-12 w-full">
              <MagneticButton className="bg-[#1A1A1A] w-full px-8 py-4 text-sm font-medium tracking-wide text-[#F2F0E9]">
                Register Free Trial
              </MagneticButton>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
