"use client";

import React from "react";
import { TOKENS } from "./shared";
import Link from "next/link";
import { Instagram, Facebook, Youtube, Twitter } from "lucide-react";

export function FooterV2() {
  return (
    <footer className="relative bg-[#1A1A1A] pt-32 pb-16 px-8 rounded-t-[4rem] text-[#F2F0E9] z-20 overflow-hidden shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
      {/* Decorative blurred glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-[800px] h-[400px] bg-[#0a2941]/50 rounded-[100%] blur-[120px] pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4 md:gap-8 border-b border-white/10 pb-16">
          <div className="col-span-1 md:col-span-2">
            <h2 className={`text-3xl font-bold tracking-tight ${TOKENS.typography.headingSans}`}>
              Altitutor
            </h2>
            <p className={`mt-4 max-w-sm text-[#F2F0E9]/60 ${TOKENS.typography.secondarySans}`}>
            A mission-driven non-profit providing accessible education for all students.
            </p>
          </div>

          <div>
            <h3 className={`text-sm font-semibold uppercase tracking-wider text-[#92b9c6] mb-6 ${TOKENS.typography.dataMono}`}>
              Platform
            </h3>
            <ul className={`space-y-4 text-[#F2F0E9]/80 ${TOKENS.typography.secondarySans}`}>
              <li><Link href="/login" className="hover:text-white transition-colors">Portal Login</Link></li>
              <li><Link href="https://altitutor.com" className="hover:text-white transition-colors">Main Website</Link></li>
            </ul>
          </div>

          <div>
            <h3 className={`text-sm font-semibold uppercase tracking-wider text-[#92b9c6] mb-6 ${TOKENS.typography.dataMono}`}>
              Social
            </h3>
            <div className="flex gap-4">
              <a href="https://www.instagram.com/altitutor/" target="_blank" rel="noreferrer" className="text-[#F2F0E9]/60 hover:text-white transition-colors hover:-translate-y-1">
                <Instagram className="w-6 h-6" />
              </a>
              <a href="https://www.facebook.com/altitutoreducation/" target="_blank" rel="noreferrer" className="text-[#F2F0E9]/60 hover:text-white transition-colors hover:-translate-y-1">
                <Facebook className="w-6 h-6" />
              </a>
              <a href="https://twitter.com/Altitutor" target="_blank" rel="noreferrer" className="text-[#F2F0E9]/60 hover:text-white transition-colors hover:-translate-y-1">
                <Twitter className="w-6 h-6" />
              </a>
              <a href="https://www.youtube.com/@altitutor" target="_blank" rel="noreferrer" className="text-[#F2F0E9]/60 hover:text-white transition-colors hover:-translate-y-1">
                <Youtube className="w-6 h-6" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping bg-green-500 absolute inline-flex h-full w-full rounded-full opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className={`text-xs uppercase tracking-widest text-[#F2F0E9]/50 ${TOKENS.typography.dataMono}`}>
              System Operational
            </span>
          </div>
          <p className={`text-sm text-[#F2F0E9]/40 ${TOKENS.typography.secondarySans}`}>
            &copy; {new Date().getFullYear()} Altitutor. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
