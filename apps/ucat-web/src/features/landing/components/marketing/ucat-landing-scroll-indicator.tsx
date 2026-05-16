"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { useEffect, useState } from "react";

const SECTION_ITEMS = [
  { id: "alti-ucat", label: "Alti UCAT" },
  { id: "overview", label: "Overview" },
  { id: "methodology", label: "Methodology" },
  { id: "how-it-works", label: "How it works" },
  { id: "pricing", label: "Pricing" },
] as const;
const { typography: typo } = MARKETING_TOKENS;

type SectionEntry = {
  id: string;
  label: string;
  element: HTMLElement;
};

export function UcatLandingScrollIndicator() {
  const [sections, setSections] = useState<{ id: string; label: string }[]>([]);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const elements: SectionEntry[] = SECTION_ITEMS.reduce<SectionEntry[]>((acc, { id, label }) => {
      const element = document.getElementById(id);
      if (element) {
        acc.push({ id, label, element });
      }
      return acc;
    }, []);

    setSections(elements.map(({ id, label }) => ({ id, label })));
    if (elements.length === 0) return;

    const onScroll = (): void => {
      const probeY = window.innerHeight * 0.4;
      const visible = elements.find(({ element }) => {
        const rect = element.getBoundingClientRect();
        return rect.top <= probeY && rect.bottom >= probeY;
      });

      if (visible) {
        setActiveSection(visible.id);
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToSection = (sectionId: string): void => {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const navbarOffset = 120;
    const y = Math.max(
      0,
      section.getBoundingClientRect().top + window.scrollY - navbarOffset,
    );
    window.history.replaceState(null, "", `#${sectionId}`);
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  if (sections.length === 0) return null;

  return (
    <div className="fixed right-6 top-1/2 z-50 hidden -translate-y-1/2 flex-col gap-4 mix-blend-difference md:flex">
      {sections.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className="group relative flex items-center justify-end"
          aria-label={`Scroll to ${id}`}
          onClick={() => scrollToSection(id)}
        >
          <span
            className={`absolute right-6 mr-2 whitespace-nowrap text-[10px] uppercase tracking-widest text-white opacity-0 drop-shadow-md transition-all duration-300 group-hover:mr-4 group-hover:opacity-100 ${typo.dataMono}`}
          >
            {label}
          </span>
          <div
            className={`h-2 rounded-full bg-white transition-all duration-300 ${
              activeSection === id
                ? "w-6 opacity-100"
                : "w-2 opacity-40 hover:w-4 hover:opacity-80"
            }`}
          />
        </button>
      ))}
    </div>
  );
}
