"use client";

import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Home,
  Target,
} from "lucide-react";
import { MARKETING_TOKENS } from "@altitutor/shared";

const { typography: typo } = MARKETING_TOKENS;

const TAB_ITEMS = [
  { icon: Home, label: "Home", active: true },
  { icon: CalendarDays, label: "Plan", active: false },
  { icon: ClipboardCheck, label: "Practice", active: false },
  { icon: BarChart3, label: "Progress", active: false },
] as const;

function UcatMobileAppScreen({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#eef0f3] text-[#1a1a1a]">
      <div
        className={`flex items-end justify-between pb-1.5 ${compact ? "px-3 pt-6" : "px-4 pb-2 pt-8"}`}
      >
        <div>
          <p
            className={`font-medium uppercase tracking-[0.12em] text-black/40 ${compact ? "text-[7px]" : "text-[9px]"}`}
          >
            Dashboard
          </p>
          <p
            className={`mt-0.5 font-semibold ${compact ? "text-[11px]" : "text-sm"} ${typo.headingSans}`}
          >
            Good afternoon, Alex
          </p>
        </div>
        <span
          className={`rounded-full bg-white font-semibold text-[#0a2941] ring-1 ring-black/[0.06] ${compact ? "px-1.5 py-0.5 text-[6px]" : "px-2 py-1 text-[8px]"}`}
        >
          Unlimited
        </span>
      </div>

      <div
        className={`min-h-0 flex-1 overflow-hidden ${compact ? "space-y-2 px-2.5 pb-2" : "space-y-2.5 px-3 pb-3"}`}
      >
        <section
          className={`rounded-2xl bg-[#0a2941] text-white shadow-sm ${compact ? "p-2.5" : "p-3.5"}`}
        >
          <div className="flex items-center justify-between gap-2 text-[#b8d2da]">
            <span
              className={`flex items-center gap-1 font-semibold uppercase tracking-[0.1em] ${compact ? "text-[7px]" : "text-[9px]"}`}
            >
              <Target
                className={compact ? "size-2.5" : "size-3.5"}
                aria-hidden
              />
              Today&apos;s next step
            </span>
            <span className={compact ? "text-[7px]" : "text-[9px]"}>25 min</span>
          </div>
          <h3
            className={`mt-2 font-semibold leading-snug ${compact ? "text-[10px]" : "text-sm"} ${typo.headingSans}`}
          >
            Strengthen Quantitative Reasoning
          </h3>
          {!compact ? (
            <p className="mt-1.5 text-[10px] leading-relaxed text-white/60">
              Timed block, then review each miss.
            </p>
          ) : null}
          <span
            className={`mt-2 flex items-center justify-between rounded-xl bg-white font-semibold text-[#0a2941] ${compact ? "px-2 py-1.5 text-[9px]" : "mt-3 px-3 py-2 text-[11px]"}`}
          >
            Start task
            <ChevronRight
              className={compact ? "size-3" : "size-3.5"}
              aria-hidden
            />
          </span>
        </section>

        <section
          className={`rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.05] ${compact ? "p-2" : "p-3"}`}
        >
          <p
            className={`font-semibold uppercase tracking-[0.1em] text-black/40 ${compact ? "text-[7px]" : "text-[9px]"}`}
          >
            Current estimate
          </p>
          <div className="mt-0.5 flex items-end justify-between gap-2">
            <strong
              className={`font-bold text-[#0a2941] ${compact ? "text-base" : "text-xl"} ${typo.headingSans}`}
            >
              2,105
            </strong>
            <span className={compact ? "text-[7px] text-black/40" : "text-[9px] text-black/40"}>
              Target 2,350
            </span>
          </div>
          <div
            className={`relative overflow-hidden rounded-xl bg-[#f5f6f7] ${compact ? "mt-1.5 h-10" : "mt-3 h-16"}`}
          >
            <div className="absolute inset-x-2 top-[28%] border-t border-dashed border-[#0a2941]/20" />
            <div className="absolute inset-x-2 top-[58%] border-t border-dashed border-black/10" />
            <div className="absolute left-[10%] top-[52%] h-0.5 w-[28%] origin-left -rotate-[12deg] rounded-full bg-[#92b9c6]" />
            <div className="absolute left-[38%] top-[40%] h-0.5 w-[28%] origin-left -rotate-[16deg] rounded-full bg-[#92b9c6]" />
            <div className="absolute left-[66%] top-[24%] h-0.5 w-[24%] origin-left -rotate-[12deg] rounded-full bg-[#92b9c6]" />
            <span className="absolute left-[10%] top-[48%] size-1.5 rounded-full border-2 border-white bg-[#0a2941]" />
            <span className="absolute left-[66%] top-[20%] size-1.5 rounded-full border-2 border-white bg-[#0a2941]" />
          </div>
        </section>

        {!compact ? (
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "VR", score: "710" },
              { label: "QR", score: "665" },
            ].map((section) => (
              <div
                key={section.label}
                className="rounded-xl bg-white p-2.5 ring-1 ring-black/[0.05]"
              >
                <p className="text-[9px] text-black/45">{section.label}</p>
                <p className={`mt-0.5 text-base font-semibold ${typo.headingSans}`}>
                  {section.score}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <nav
        className={`grid shrink-0 grid-cols-4 border-t border-black/[0.06] bg-white ${compact ? "px-0.5 py-1.5" : "px-1 py-2"}`}
        aria-hidden
      >
        {TAB_ITEMS.map(({ icon: Icon, label, active }) => (
          <div
            key={label}
            className={`flex flex-col items-center gap-0.5 ${
              active ? "text-[#0a2941]" : "text-black/35"
            }`}
          >
            <Icon className={compact ? "size-3" : "size-3.5"} aria-hidden />
            <span className={compact ? "text-[7px] font-medium" : "text-[8px] font-medium"}>
              {label}
            </span>
          </div>
        ))}
      </nav>
    </div>
  );
}

export function UcatMobileAppPhonePreview({
  compact = false,
  bleed = false,
}: {
  compact?: boolean;
  bleed?: boolean;
}) {
  const phoneWidth = bleed
    ? "w-[8.75rem] sm:w-[12rem]"
    : compact
      ? "w-[9.5rem]"
      : "w-[min(72%,15.5rem)] sm:w-[min(68%,16.5rem)]";
  const screenHeight = bleed
    ? "h-[20rem] sm:h-[21rem]"
    : compact
      ? "h-[15.5rem]"
      : "h-[22rem] sm:h-[23rem]";

  const phoneChrome = bleed ? (
    <div
      className={`relative overflow-hidden rounded-[2.15rem] ${phoneWidth} shadow-[0_16px_40px_rgba(10,41,65,0.18),0_8px_20px_rgba(0,0,0,0.12)]`}
    >
      <div className="relative overflow-hidden rounded-[2.15rem] border-[3px] border-[#1c1c1e] bg-[#1c1c1e] p-[3px]">
        <div className="pointer-events-none absolute left-1/2 top-[0.45rem] z-20 h-[1.15rem] w-[3.75rem] -translate-x-1/2 rounded-full bg-black" />

        <div className="pointer-events-none absolute -left-[3px] top-[4.25rem] z-10 h-7 w-[3px] rounded-l-sm bg-[#3a3a3c]" />
        <div className="pointer-events-none absolute -left-[3px] top-[6.25rem] z-10 h-10 w-[3px] rounded-l-sm bg-[#3a3a3c]" />
        <div className="pointer-events-none absolute -left-[3px] top-[8.5rem] z-10 h-10 w-[3px] rounded-l-sm bg-[#3a3a3c]" />
        <div className="pointer-events-none absolute -right-[3px] top-[6rem] z-10 h-14 w-[3px] rounded-r-sm bg-[#3a3a3c]" />

        <div
          className={`relative overflow-hidden rounded-[1.85rem] bg-[#eef0f3] ${screenHeight}`}
        >
          <UcatMobileAppScreen compact={compact || bleed} />
          <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center">
            <span className="h-1 w-14 rounded-full bg-black/20" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div
      className={`absolute bottom-0 left-1/2 -translate-x-1/2 ${phoneWidth}`}
    >
      <div className="relative rounded-t-[2rem] border-[2.5px] border-b-0 border-[#111] bg-[#111] p-[2.5px] pb-0 shadow-[0_-8px_32px_rgba(10,41,65,0.16),0_18px_36px_rgba(0,0,0,0.2)]">
        <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-[1.1rem] w-[3.5rem] -translate-x-1/2 rounded-full bg-black" />

        <div className="pointer-events-none absolute -left-[2px] top-[4.5rem] h-6 w-[2px] rounded-l-sm bg-[#2a2a2a]" />
        <div className="pointer-events-none absolute -left-[2px] top-[6.75rem] h-9 w-[2px] rounded-l-sm bg-[#2a2a2a]" />
        <div className="pointer-events-none absolute -right-[2px] top-[5.5rem] h-11 w-[2px] rounded-r-sm bg-[#2a2a2a]" />

        <div
          className={`relative overflow-hidden rounded-t-[1.75rem] bg-white ${screenHeight}`}
        >
          <UcatMobileAppScreen compact={compact} />
        </div>
      </div>
    </div>
  );

  if (bleed) {
    return (
      <div className="absolute top-0 right-0" aria-hidden>
        {phoneChrome}
      </div>
    );
  }

  const containerMinH = compact ? "min-h-[14rem]" : "min-h-[19rem] sm:min-h-[21rem]";

  return (
    <div
      className={`relative flex justify-center overflow-hidden ${containerMinH}`}
      aria-hidden
    >
      {phoneChrome}
    </div>
  );
}
