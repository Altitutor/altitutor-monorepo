"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { useEffect, useState } from "react";

const SECTION_ITEMS = [
  { id: "altitutor-ucat", label: "Altitutor UCAT" },
  { id: "features", label: "Features" },
  { id: "how-it-works", label: "How it works" },
  { id: "mission", label: "Our mission" },
  { id: "comparison", label: "Comparison" },
  { id: "pricing", label: "Pricing" },
] as const;
const { typography: typo } = MARKETING_TOKENS;

export function UcatLandingScrollIndicator() {
  const [activeSection, setActiveSection] = useState<string>(
    SECTION_ITEMS[0].id,
  );

  useEffect(() => {
    const onScroll = () => {
      const probeY = window.innerHeight * 0.4;
      const visible = SECTION_ITEMS.find(({ id }) => {
        const element = document.getElementById(id);
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return rect.top <= probeY && rect.bottom >= probeY;
      });
      if (visible) setActiveSection(visible.id);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const y = Math.max(
      0,
      section.getBoundingClientRect().top + window.scrollY - 104,
    );
    window.history.replaceState(null, "", `#${sectionId}`);
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <div className="fixed right-5 top-1/2 z-50 hidden -translate-y-1/2 flex-col gap-4 md:flex">
      {SECTION_ITEMS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className="group relative flex items-center justify-end"
          aria-label={`Scroll to ${label}`}
          onClick={() => scrollToSection(id)}
        >
          <span
            className={`pointer-events-none absolute right-6 mr-1 whitespace-nowrap rounded-full bg-marketing-charcoal px-2 py-1 text-[9px] uppercase tracking-widest text-white opacity-0 shadow-md transition-all group-hover:mr-3 group-hover:opacity-100 ${typo.dataMono}`}
          >
            {label}
          </span>
          <span
            className={`h-2 rounded-full bg-marketing-primary shadow-[0_0_0_1px_rgba(255,255,255,0.7)] transition-all ${activeSection === id ? "w-6 opacity-100" : "w-2 opacity-40 group-hover:w-4 group-hover:opacity-80"}`}
          />
        </button>
      ))}
    </div>
  );
}
