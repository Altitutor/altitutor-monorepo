"use client";

import { Info } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  UCAT_INTERACTION_EASE,
  UCAT_SEGMENTED_TAB,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";

type SegmentedControlOption<T> = {
  value: T;
  label: string;
  infoTooltip?: string;
};

type SegmentedControlProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedControlOption<T>[];
  className?: string;
};

type IndicatorRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const INDICATOR_TRANSITION = {
  duration: 0.28,
  ease: [0.32, 0.72, 0, 1] as const,
};

const segmentTabPadding = [
  "inline-flex items-center gap-1.5 px-3 py-1.5",
  "transition-[color] duration-200",
  UCAT_INTERACTION_EASE,
].join(" ");

const indicatorChrome = cn(
  "pointer-events-none absolute z-0 rounded-ucatControl bg-card shadow-sm",
  "ring-1 ring-[hsl(0_0%_0%/0.05)] dark:ring-[hsl(0_0%_100%/0.07)]",
);

/** Matches the set generator page tab selector style. */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
}: SegmentedControlProps<T>) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef(new Map<string, HTMLElement>());
  const [indicator, setIndicator] = useState<IndicatorRect | null>(null);

  const setSegmentRef = useCallback(
    (optionValue: string) => (el: HTMLElement | null) => {
      if (el) {
        segmentRefs.current.set(optionValue, el);
      } else {
        segmentRefs.current.delete(optionValue);
      }
    },
    [],
  );

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    const activeEl = segmentRefs.current.get(value);
    if (!container || !activeEl) {
      setIndicator(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();
    setIndicator({
      left: activeRect.left - containerRect.left,
      top: activeRect.top - containerRect.top,
      width: activeRect.width,
      height: activeRect.height,
    });
  }, [value]);

  useLayoutEffect(() => {
    updateIndicator();

    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => updateIndicator());
    resizeObserver.observe(container);
    for (const el of segmentRefs.current.values()) {
      resizeObserver.observe(el);
    }

    window.addEventListener("resize", updateIndicator);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [updateIndicator, options]);

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={containerRef}
        className={cn(
          "relative inline-flex rounded-ucatControl border-0 bg-muted p-0.5 text-xs ring-1 ring-[hsl(0_0%_0%/0.04)] dark:ring-[hsl(0_0%_100%/0.06)]",
          "transition-[box-shadow,ring-color] duration-200",
          UCAT_INTERACTION_EASE,
          className,
        )}
        role="tablist"
      >
        {indicator ? (
          <motion.div
            aria-hidden
            className={indicatorChrome}
            initial={false}
            animate={{
              left: indicator.left,
              top: indicator.top,
              width: indicator.width,
              height: indicator.height,
            }}
            transition={
              reduceMotion ? { duration: 0 } : INDICATOR_TRANSITION
            }
          />
        ) : null}

        {options.map((option) => {
          const isActive = value === option.value;

          if (option.infoTooltip) {
            return (
              <div
                key={option.value}
                ref={setSegmentRef(option.value)}
                className={cn(
                  "group relative z-10 inline-flex items-stretch overflow-hidden rounded-ucatControl",
                  isActive ? "text-foreground" : "text-foreground",
                )}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onValueChange(option.value)}
                  className={cn(
                    segmentTabPadding,
                    "rounded-l-md rounded-r-none",
                    !isActive && "hover:bg-muted/80",
                  )}
                >
                  {option.label}
                </button>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center justify-center rounded-r-md rounded-l-none border-l px-2 py-1.5",
                        "text-muted-foreground transition-[color] duration-200",
                        UCAT_INTERACTION_EASE,
                        "hover:text-foreground",
                        !isActive && "group-hover:bg-muted/80",
                        isActive
                          ? "border-foreground/12"
                          : "border-black/[0.06] dark:border-white/12",
                      )}
                      aria-label="About this option"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="h-3 w-3 shrink-0" aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px]">
                    {option.infoTooltip}
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          }

          return (
            <button
              key={option.value}
              ref={setSegmentRef(option.value)}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onValueChange(option.value)}
              className={cn(
                UCAT_SEGMENTED_TAB,
                "relative z-10 transition-[color] duration-200",
                isActive
                  ? "text-foreground"
                  : "text-foreground hover:bg-muted/80",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
