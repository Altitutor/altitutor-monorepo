"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { useEffect, useState } from "react";
import { AnalyticsLink } from "../analytics-link";
import { PRODUCT_LINKS } from "@/lib/site";
import { MagneticButton } from "./magnetic-button";

const { typography: typo } = MARKETING_TOKENS;

export function UcatLandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 72);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      aria-label="Altitutor UCAT"
      className={`fixed left-1/2 top-4 z-50 flex h-16 w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2 items-center justify-between rounded-full px-4 transition-[background-color,border-color,box-shadow,backdrop-filter,color] duration-500 sm:top-6 sm:px-6 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:justify-normal ${
        scrolled
          ? "border border-white/10 bg-marketing-charcoal/90 text-marketing-cream shadow-[0_8px_32px_rgba(0,0,0,0.24)] backdrop-blur-xl"
          : "border border-transparent bg-transparent text-marketing-charcoal"
      }`}
    >
      <a
        href="/ucat/#altitutor-ucat"
        className={`text-base font-bold tracking-tight sm:text-lg ${typo.headingSans}`}
      >
        Altitutor UCAT
      </a>
      <div
        className={`hidden items-center gap-7 text-sm lg:flex ${typo.secondarySans}`}
      >
        <a
          href="/ucat/#features"
          className="opacity-70 transition-opacity hover:opacity-100"
        >
          Features
        </a>
        <a
          href="/ucat/#how-it-works"
          className="opacity-70 transition-opacity hover:opacity-100"
        >
          How it works
        </a>
        <a
          href="/ucat/#mission"
          className="opacity-70 transition-opacity hover:opacity-100"
        >
          Our mission
        </a>
        <a
          href="/ucat/#pricing"
          className="opacity-70 transition-opacity hover:opacity-100"
        >
          Pricing
        </a>
      </div>
      <div className="flex min-w-max items-center justify-end gap-1 justify-self-end sm:gap-2">
        <AnalyticsLink
          href={PRODUCT_LINKS.ucatLogin}
          analytics={{ product: "ucat", placement: "navbar", action: "login" }}
          className={`rounded-full px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
            scrolled ? "hover:bg-white/10" : "hover:bg-black/5"
          }`}
        >
          Sign in
        </AnalyticsLink>
        <AnalyticsLink
          href={PRODUCT_LINKS.ucatSignup}
          analytics={{
            product: "ucat",
            placement: "navbar",
            action: "start_free",
          }}
        >
          <MagneticButton className="bg-marketing-accent px-4 py-2 text-sm font-semibold text-marketing-charcoal sm:px-6">
            Start free
          </MagneticButton>
        </AnalyticsLink>
      </div>
    </nav>
  );
}
