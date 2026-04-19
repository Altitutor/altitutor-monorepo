"use client";

import React, { useEffect, useState } from "react";
import { TOKENS } from "./shared";

export function ScrollIndicatorV2() {
  const [sections, setSections] = useState<{ id: string }[]>([]);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    // Dynamically find all sections with an id
    const updateSections = () => {
      const elements = Array.from(document.querySelectorAll("section[id]"));
      setSections(elements.map((el) => ({ id: el.id })));

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveSection(entry.target.id);
            }
          });
        },
        { threshold: 0.3 }
      );

      elements.forEach((el) => observer.observe(el));
      return observer;
    };

    // Use a slight timeout to let GSAP and React DOM paint
    const timeout = setTimeout(() => {
      const obs = updateSections();
      return () => obs.disconnect();
    }, 500);

    return () => clearTimeout(timeout);
  }, []);

  if (sections.length === 0) return null;

  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-4 mix-blend-difference hidden md:flex">
      {sections.map(({ id }) => (
        <a
          key={id}
          href={`#${id}`}
          className="group relative flex items-center justify-end"
          aria-label={`Scroll to ${id}`}
        >
          <span
            className={`absolute right-6 mr-2 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:mr-4 uppercase tracking-widest text-[10px] text-white whitespace-nowrap drop-shadow-md ${TOKENS.typography.dataMono}`}
          >
            {id}
          </span>
          <div
            className={`h-2 rounded-full transition-all duration-300 bg-white ${
              activeSection === id ? "w-6 opacity-100" : "w-2 opacity-40 hover:opacity-80 hover:w-4"
            }`}
          />
        </a>
      ))}
    </div>
  );
}
