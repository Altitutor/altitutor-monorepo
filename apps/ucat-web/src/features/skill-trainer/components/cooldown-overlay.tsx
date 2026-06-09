"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function CircularCountdown({
  progress,
  secondsLeft,
}: {
  progress: number;
  secondsLeft: number;
}) {
  const offset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg className="-rotate-90" width="112" height="112" viewBox="0 0 112 112" aria-hidden>
        <circle
          cx="56"
          cy="56"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-amber-200/40 dark:text-amber-900/50"
        />
        <circle
          cx="56"
          cy="56"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="text-amber-500 transition-[stroke-dashoffset] duration-100 ease-linear"
        />
      </svg>
      <span className="absolute text-3xl font-bold tabular-nums text-amber-900 dark:text-amber-100">
        {secondsLeft}
      </span>
    </div>
  );
}

export function CooldownOverlay({
  until,
  durationSeconds,
}: {
  until: string;
  durationSeconds: number;
}) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const tick = () => {
      const ms = new Date(until).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [until]);

  const progress = useMemo(() => {
    if (durationSeconds <= 0) return 0;
    return Math.max(0, Math.min(1, secondsLeft / durationSeconds));
  }, [durationSeconds, secondsLeft]);

  if (!mounted || secondsLeft <= 0) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="flex flex-col items-center gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-10 py-8 shadow-xl dark:border-amber-500/30 dark:bg-amber-950/90"
      >
        <CircularCountdown progress={progress} secondsLeft={secondsLeft} />
        <p className="text-lg font-semibold text-amber-900 dark:text-amber-100">Cooldown</p>
        <p className="text-sm text-amber-700/80 dark:text-amber-200/70">
          Hang tight before your next move
        </p>
      </motion.div>
    </div>,
    document.body,
  );
}
