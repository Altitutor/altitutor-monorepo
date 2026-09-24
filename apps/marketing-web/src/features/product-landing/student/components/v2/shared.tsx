"use client";

import React from "react";
import { MARKETING_TOKENS } from "@altitutor/shared";

export const TOKENS = MARKETING_TOKENS;

// ==========================================
// SHARED COMPONENTS
// ==========================================
export const NoiseOverlay = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 z-[9999] h-dvh w-screen opacity-5 mix-blend-multiply">
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <filter id="noiseFilter">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.65"
          numOctaves="3"
          stitchTiles="stitch"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#noiseFilter)" />
    </svg>
  </div>
);

export const MagneticButton = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <span
      className={`group relative inline-flex overflow-hidden rounded-full transition-transform duration-500 hover:scale-[1.03] active:scale-[0.97] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${className}`}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
      <span className="absolute inset-0 z-0 bg-black/10 translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:translate-y-0" />
    </span>
  );
};
