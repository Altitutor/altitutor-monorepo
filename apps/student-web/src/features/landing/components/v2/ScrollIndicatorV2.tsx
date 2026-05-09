"use client";

import React, { useEffect, useState } from "react";
import { TOKENS } from "./shared";

const SECTION_ITEMS = [
  { id: "mission", label: "Mission" },
  { id: "resources", label: "Resources" },
  { id: "ucat", label: "UCAT" },
  { id: "community", label: "Community" },
  { id: "ecosystem", label: "Get Started" },
] as const;

export function ScrollIndicatorV2() {
  const [sections, setSections] = useState<{ id: string; label: string }[]>([]);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const elements = SECTION_ITEMS.reduce<
      Array<{ id: string; label: string; element: HTMLElement }>
    >((acc, { id, label }) => {
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
    const y = section.getBoundingClientRect().top + window.scrollY - navbarOffset;
    window.history.replaceState(null, "", `#${sectionId}`);
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  if (sections.length === 0) return null;

  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-4 mix-blend-difference hidden md:flex">
      {sections.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className="group relative flex items-center justify-end"
          aria-label={`Scroll to ${id}`}
          onClick={() => scrollToSection(id)}
        >
          <span
            className={`absolute right-6 mr-2 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:mr-4 uppercase tracking-widest text-[10px] text-white whitespace-nowrap drop-shadow-md ${TOKENS.typography.dataMono}`}
          >
            {label}
          </span>
          <div
            className={`h-2 rounded-full transition-all duration-300 bg-white ${
              activeSection === id ? "w-6 opacity-100" : "w-2 opacity-40 hover:opacity-80 hover:w-4"
            }`}
          />
        </button>
      ))}
    </div>
  );
}
