"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MagneticButton } from "./magnetic-button";

const { typography: typo } = MARKETING_TOKENS;

export function UcatLandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed left-1/2 top-6 z-50 grid h-16 w-[90%] max-w-5xl -translate-x-1/2 grid-cols-[1fr_auto_1fr] items-center rounded-full px-6 transition-all duration-500 ${
        scrolled
          ? "border border-black/5 bg-marketing-cream/80 text-marketing-charcoal shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl"
          : "bg-transparent text-marketing-cream"
      }`}
    >
      <div className={`text-xl font-bold tracking-tight ${typo.headingSans}`}>
        Alti UCAT
      </div>
      <div
        className={`hidden gap-8 text-sm tracking-wide md:flex ${typo.secondarySans}`}
      >
        <a
          href="#methodology"
          className="opacity-80 transition-transform hover:-translate-y-px hover:opacity-100"
        >
          Methodology
        </a>
        <a
          href="#how-it-works"
          className="opacity-80 transition-transform hover:-translate-y-px hover:opacity-100"
        >
          How it works
        </a>
        <a
          href="#pricing"
          className="opacity-80 transition-transform hover:-translate-y-px hover:opacity-100"
        >
          Pricing
        </a>
      </div>
      <div className="flex items-center justify-end gap-2 sm:gap-3">
        <Link
          href="/login"
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-transform hover:-translate-y-px ${
            scrolled
              ? "text-marketing-charcoal hover:bg-black/5"
              : "text-marketing-cream hover:bg-white/10"
          }`}
        >
          Sign In
        </Link>
        <Link href="/signup">
          <MagneticButton
            className={`px-4 py-2 text-sm font-medium sm:px-6 ${
              scrolled
                ? "bg-marketing-accent text-marketing-charcoal"
                : "bg-white/10 text-marketing-cream backdrop-blur-md"
            }`}
          >
            Free Trial
          </MagneticButton>
        </Link>
      </div>
    </nav>
  );
}
