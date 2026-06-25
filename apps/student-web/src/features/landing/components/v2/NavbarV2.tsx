"use client";

import React, { useEffect, useState } from "react";
import { TOKENS, MagneticButton } from "./shared";
import Link from "next/link";

export function NavbarV2() {
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
      <div className="ml-auto flex items-center justify-end gap-2 sm:gap-3">
        <Link
          href="/login"
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-transform hover:-translate-y-[1px] ${
            scrolled
              ? "text-[#1A1A1A] hover:bg-black/5"
              : "text-[#F2F0E9] hover:bg-white/10"
          }`}
        >
          Login
        </Link>
        <Link href="/booking/trial-session">
          <MagneticButton
            className={`px-4 py-2 text-sm font-medium sm:px-6 ${
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
