"use client";

import type { ReactNode } from "react";

/** Shared shell for product demos: no user interaction, no internal scroll. */
export function DemoStage({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`ucat-product-ui pointer-events-none relative h-full overflow-hidden bg-[#f6f7f9] text-[#1a1a1a] select-none ${className}`}
      aria-hidden
    >
      {children}
    </div>
  );
}

/** Fake cursor used in looping “someone is using this” demos. */
export function DemoCursor({
  cursorRef,
}: {
  cursorRef:
    | React.RefObject<HTMLDivElement | null>
    | React.MutableRefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={cursorRef as React.RefObject<HTMLDivElement>}
      className="pointer-events-none absolute left-0 top-0 z-50 opacity-0"
      style={{ transform: "translate(-4px, -2px)" }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M5 3l14 8.5-6.2 1.6L10.2 21 5 3z"
          fill="#0a2941"
          stroke="#fff"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="absolute left-3 top-3 size-3 rounded-full bg-[#0a2941]/25 opacity-0"
        data-demo-cursor-ripple
      />
    </div>
  );
}

export const DEMO_EASE = [0.32, 0.72, 0, 1] as const;

export const demoContainerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.04, delayChildren: 0.03 },
  },
};

export const demoItemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: DEMO_EASE },
  },
};
