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
      className={`fixed left-1/2 top-6 z-50 flex h-16 w-[90%] max-w-5xl -translate-x-1/2 items-center justify-between rounded-full px-6 transition-all duration-500 ${
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
        {["Methodology", "Systems", "Pricing"].map((item) => (
          <a
            key={item}
            href={`#${item.toLowerCase()}`}
            className="opacity-80 transition-transform hover:-translate-y-px hover:opacity-100"
          >
            {item}
          </a>
        ))}
        <Link
          href="/login"
          className="opacity-80 transition-transform hover:-translate-y-px hover:opacity-100"
        >
          Sign In
        </Link>
      </div>
      <Link href="/signup">
        <MagneticButton
          className={`px-6 py-2 text-sm font-medium ${
            scrolled
              ? "bg-marketing-accent text-marketing-charcoal"
              : "bg-white/10 text-marketing-cream backdrop-blur-md"
          }`}
        >
          Free Trial
        </MagneticButton>
      </Link>
    </nav>
  );
}
