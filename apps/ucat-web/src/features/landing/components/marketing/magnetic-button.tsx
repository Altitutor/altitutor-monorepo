"use client";

import type { ReactNode } from "react";

export type MagneticButtonProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
};

export function MagneticButton({
  children,
  className,
  onClick,
}: MagneticButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-full transition-transform duration-500 hover:scale-[1.03] active:scale-[0.97] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${className ?? ""}`}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
      <span className="absolute inset-0 z-0 translate-y-full bg-black/10 transition-transform duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:translate-y-0" />
    </button>
  );
}
