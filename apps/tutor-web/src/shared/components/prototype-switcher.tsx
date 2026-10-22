"use client";

import { useEffect, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

// Throwaway UI review control; deliberately unavailable in production.
export function PrototypeSwitcher({
  variants,
}: {
  variants: { key: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = Math.max(
    0,
    variants.findIndex((variant) => variant.key === params.get("variant")),
  );
  const cycle = useCallback(
    (direction: number) => {
      const next = (current + direction + variants.length) % variants.length;
      const query = new URLSearchParams(params.toString());
      query.set("variant", variants[next].key);
      router.replace(`${pathname}?${query.toString()}`, { scroll: false });
    },
    [current, params, pathname, router, variants],
  );

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest(
          'input, textarea, select, [contenteditable="true"], [role="slider"]',
        )
      )
        return;
      if (event.altKey || event.metaKey || event.ctrlKey) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        cycle(event.key === "ArrowLeft" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [cycle]);

  if (process.env.NODE_ENV === "production") return null;
  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-950 p-2 text-white shadow-xl ring-1 ring-white/20">
      <button
        aria-label="Previous layout"
        onClick={() => cycle(-1)}
        className="rounded-full p-3 hover:bg-white/15"
      >
        <ArrowLeft size={17} />
      </button>
      <div className="min-w-48 text-center">
        <div className="text-[9px] uppercase tracking-[.2em] text-slate-400">
          Throwaway prototype · ← →
        </div>
        <div className="text-sm font-medium">
          {variants[current].key} — {variants[current].name}
        </div>
      </div>
      <button
        aria-label="Next layout"
        onClick={() => cycle(1)}
        className="rounded-full p-3 hover:bg-white/15"
      >
        <ArrowRight size={17} />
      </button>
    </div>
  );
}
