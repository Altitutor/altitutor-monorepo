"use client";

import { useEffect, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { cn } from "@/lib/utils";

const EASE = [0.32, 0.72, 0, 1] as const;

type AnimatedIntegerProps = {
  value: number;
  className?: string;
  /** Animation length in seconds */
  duration?: number;
};

/**
 * Counts up (or between values) with eased motion. Respects prefers-reduced-motion.
 */
export function AnimatedInteger({
  value,
  className,
  duration = 0.75,
}: AnimatedIntegerProps) {
  const reduceMotion = useReducedMotion();
  const m = useMotionValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      m.set(value);
      setDisplay(value);
      return;
    }
    const controls = animate(m, value, {
      duration,
      ease: EASE,
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value, duration, reduceMotion, m]);

  return <span className={className}>{display}</span>;
}

type AnimatedFractionProps = {
  numerator: number;
  denominator: number;
  className?: string;
  duration?: number;
};

export function AnimatedFraction({
  numerator,
  denominator,
  className,
  duration = 0.75,
}: AnimatedFractionProps) {
  return (
    <span className={className}>
      <AnimatedInteger value={numerator} duration={duration} />
      <span> / </span>
      <AnimatedInteger value={denominator} duration={duration} />
    </span>
  );
}

type ProgressCircularProps = {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** Center label e.g. 72% */
  showLabel?: boolean;
  /** Second line under the ring (animated count + static suffix) */
  footerCount?: number;
  footerSuffix?: string;
};

/**
 * Donut progress with animated stroke and optional footer count.
 */
export function ProgressCircular({
  percentage,
  size = 120,
  strokeWidth: strokeWidthProp,
  className,
  showLabel = true,
  footerCount,
  footerSuffix = "questions completed",
}: ProgressCircularProps) {
  const reduceMotion = useReducedMotion();
  const sw = strokeWidthProp ?? (size <= 56 ? 4 : 10);
  const radius = (size - sw) / 2;
  const circumference = 2 * Math.PI * radius;
  const capped = Math.min(100, Math.max(0, percentage));
  const targetOffset = circumference - (capped / 100) * circumference;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2",
        className,
      )}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          aria-label={`${capped}% progress`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={sw}
            className="text-muted/30"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={sw}
            strokeDasharray={circumference}
            strokeLinecap="round"
            className="text-accent"
            initial={
              reduceMotion ? false : { strokeDashoffset: circumference }
            }
            animate={{ strokeDashoffset: targetOffset }}
            transition={{
              duration: reduceMotion ? 0 : 0.85,
              ease: EASE,
            }}
          />
        </svg>
        {showLabel ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={cn(
                "font-semibold tabular-nums",
                size <= 56 ? "text-xs" : "text-lg",
              )}
            >
              <AnimatedInteger value={capped} duration={0.7} />%
            </span>
          </div>
        ) : null}
      </div>
      {footerCount != null ? (
        <span className="text-xs text-muted-foreground tabular-nums">
          <AnimatedInteger value={footerCount} duration={0.75} />{" "}
          {footerSuffix}
        </span>
      ) : null}
    </div>
  );
}
