"use client";

import React, { useEffect, useState } from "react";
import { TOKENS, MagneticButton } from "./shared";
import Link from "next/link";

export function NavbarV2() {
  const [scrolled, setScrolled] = useState(false);
  const navItems = [
    { label: "Mission", id: "mission" },
    { label: "Resources", id: "resources" },
    { label: "Community", id: "community" },
    { label: "Get Started", id: "ecosystem" },
  ] as const;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId: string): void => {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const navbarOffset = 120;
    const y = section.getBoundingClientRect().top + window.scrollY - navbarOffset;
    window.history.replaceState(null, "", `#${sectionId}`);
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <nav
      className={`fixed top-6 left-1/2 z-50 flex h-16 w-[90%] max-w-5xl -translate-x-1/2 items-center justify-between rounded-full px-6 transition-all duration-500 ${
        scrolled
          ? "bg-[#F2F0E9]/80 text-[#1A1A1A] shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl border border-black/5"
          : "bg-transparent text-[#F2F0E9]"
      }`}
    >
      <div
        className={`text-xl font-bold tracking-tight ${TOKENS.typography.headingSans}`}
      >
        Altitutor
      </div>
      <div
        className={`hidden md:flex gap-8 text-sm tracking-wide ${TOKENS.typography.secondarySans}`}
      >
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className="transition-transform hover:-translate-y-[1px] opacity-80 hover:opacity-100"
            onClick={() => scrollToSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex gap-4">
        <Link href="/booking/trial-session">
          <MagneticButton
            className={`px-6 py-2 text-sm font-medium ${
              scrolled
                ? "bg-[#92b9c6] text-[#1A1A1A]"
                : "bg-white text-[#1A1A1A] backdrop-blur-md"
            }`}
          >
            Book Trial
          </MagneticButton>
        </Link>
      </div>
    </nav>
  );
}
