"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { gsap } from "gsap";
import { AnimatePresence, motion } from "motion/react";
import { FindWordTrainer } from "@altitutor/ui";
import type { FindWordItemContent } from "@altitutor/shared";
import { Clock3, Flame, LogOut, Trophy } from "lucide-react";
import clsx from "clsx";
import { DemoCursor, DEMO_EASE } from "./demo-stage";

const DEMO_GSAP_EASE = `cubic-bezier(${DEMO_EASE.join(", ")})`;

const TRAINER_CONFIG = {
  points_correct: 10,
  points_wrong: 0,
  streak_enabled: true,
  streak_multiplier_steps: [
    { min_streak: 3, multiplier: 1.5 },
    { min_streak: 5, multiplier: 2 },
  ],
} as const;

function getStreakMultiplier(streak: number): number {
  let multiplier = 1;
  for (const step of TRAINER_CONFIG.streak_multiplier_steps) {
    if (streak >= step.min_streak) multiplier = step.multiplier;
  }
  return multiplier;
}

function scoreForCorrectPlacement(streakAfter: number): number {
  const raw =
    TRAINER_CONFIG.points_correct * getStreakMultiplier(streakAfter);
  return Math.max(1, Math.round(raw * 0.45));
}

function scoreForItemComplete(): number {
  return Math.max(1, Math.round(20 * 0.45));
}

/** Sample find-the-word item from ucat_skill_trainer_sample_items.sql (hospital passage). */
const HOSPITAL_FIND_WORD: FindWordItemContent = {
  passage: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "The hospital opened a new wing last spring. Nurses trained on the ward daily while Dr Patel led the pilot programme. Patients were transferred from the older building once the equipment arrived.",
          },
        ],
      },
    ],
  },
  keywords: [
    { id: "kw1", text: "hospital" },
    { id: "kw2", text: "Nurses" },
    { id: "kw3", text: "Patel" },
  ],
};

const DEMO_SEQUENCE = [
  HOSPITAL_FIND_WORD.keywords[0]!,
  HOSPITAL_FIND_WORD.keywords[1]!,
  HOSPITAL_FIND_WORD.keywords[2]!,
] as const;

function getElementCenter(
  stage: HTMLElement,
  target: HTMLElement,
): { left: number; top: number } {
  const stageRect = stage.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  return {
    left: targetRect.left - stageRect.left + targetRect.width / 2 - 4,
    top: targetRect.top - stageRect.top + targetRect.height / 2 - 2,
  };
}

function KeywordDragGhost({
  cursorRef,
  label,
}: {
  cursorRef: RefObject<HTMLDivElement | null>;
  label: string;
}) {
  const ghostRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    const ghost = ghostRef.current;
    if (!cursor || !ghost) return;

    const sync = () => {
      const left = gsap.getProperty(cursor, "left") as number;
      const top = gsap.getProperty(cursor, "top") as number;
      gsap.set(ghost, { left: left + 14, top: top + 12, opacity: 1 });
    };

    sync();
    gsap.ticker.add(sync);
    return () => {
      gsap.ticker.remove(sync);
    };
  }, [cursorRef]);

  return (
    <span
      ref={ghostRef}
      className="pointer-events-none absolute left-0 top-0 z-40 rounded-md border border-[#0a2941]/30 bg-white px-3 py-2 text-sm font-medium shadow-md opacity-0"
    >
      {label}
    </span>
  );
}

function ScoreDeltaBadge({
  delta,
}: {
  delta: { id: number; value: number } | null;
}) {
  const magnitude = Math.abs(delta?.value ?? 0);
  const sizeClass =
    magnitude >= 9
      ? "px-3 py-1 text-base"
      : magnitude >= 5
        ? "px-2.5 py-0.5 text-sm"
        : "px-2 py-0.5 text-xs";
  const lift = magnitude >= 9 ? -18 : magnitude >= 5 ? -14 : -10;

  return (
    <AnimatePresence>
      {delta && delta.value !== 0 ? (
        <motion.span
          key={delta.id}
          initial={{ opacity: 0, y: 8, scale: 0.85 }}
          animate={{ opacity: 1, y: lift, scale: magnitude >= 9 ? 1.12 : 1 }}
          exit={{ opacity: 0, y: lift - 16, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          className={clsx(
            "inline-flex rounded-full font-black tabular-nums shadow-sm ring-1",
            sizeClass,
            delta.value > 0
              ? "bg-green-500 text-white ring-green-400/70"
              : "bg-red-500 text-white ring-red-400/70",
          )}
        >
          {delta.value > 0 ? "+" : ""}
          {delta.value}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

function TrainerScoreBar({
  remaining,
  score,
  streak,
  scoreDelta,
}: {
  remaining: number;
  score: number;
  streak: number;
  scoreDelta: { id: number; value: number } | null;
}) {
  const showStreak = streak >= 2;
  const streakLevel =
    streak >= 15 ? 4 : streak >= 10 ? 3 : streak >= 5 ? 2 : 1;

  return (
    <div className="flex flex-nowrap items-center justify-between gap-1.5 overflow-visible rounded-xl border border-[#0a2941]/20 bg-gradient-to-r from-[#0a2941]/5 via-white to-[#0a2941]/5 px-2 py-2 shadow-sm sm:gap-3 sm:px-3">
      <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-visible sm:gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-sm shadow-sm backdrop-blur-sm">
          <Clock3 className="size-3.5 shrink-0 text-black/45" aria-hidden />
          <span className="hidden text-black/45 sm:inline">Time</span>
          <span className="font-bold tabular-nums">{remaining}s</span>
        </span>
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-sm shadow-sm backdrop-blur-sm">
            <Trophy className="size-3.5 shrink-0 text-black/45" aria-hidden />
            <span className="hidden text-black/45 sm:inline">Score</span>
            <span className="font-bold tabular-nums">{score}</span>
          </span>
          <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap">
            <ScoreDeltaBadge delta={scoreDelta} />
          </div>
          {showStreak ? (
            <div className="pointer-events-none absolute -right-2 -top-2 overflow-visible">
              <motion.div
                key={streak}
                className={clsx(
                  "inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full border px-1.5 text-xs font-bold tabular-nums shadow-sm",
                  streakLevel === 1 &&
                    "border-orange-300/50 bg-orange-500/10 text-orange-700",
                  streakLevel === 2 &&
                    "border-orange-400/60 bg-orange-500/20 text-orange-800",
                  streakLevel >= 3 &&
                    "border-amber-300/70 bg-amber-400/25 text-amber-900",
                )}
                initial={{ scale: 0.95 }}
                animate={{
                  scale:
                    streakLevel >= 3 ? [1.03, 1.13, 1.03] : [1, 1.07, 1],
                }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              >
                <Flame
                  className={clsx(
                    "shrink-0 fill-current",
                    streakLevel === 1 && "size-3.5 text-orange-500",
                    streakLevel === 2 && "size-4 text-orange-500",
                    streakLevel >= 3 && "size-[18px] text-amber-400",
                  )}
                  aria-hidden
                />
                {streak}
              </motion.div>
            </div>
          ) : null}
        </div>
      </div>
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-black/35">
        <LogOut className="size-4" aria-hidden />
      </span>
    </div>
  );
}

export function MarketingFindWordTrainerPreview({ animate }: { animate: boolean }) {
  const [placedIds, setPlacedIds] = useState<string[]>([]);
  const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);
  const [draggingKeywordId, setDraggingKeywordId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(45);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [scoreDelta, setScoreDelta] = useState<{ id: number; value: number } | null>(
    null,
  );
  const scoreDeltaIdRef = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => {
      setRemaining((value) => (value <= 4 ? 45 : value - 4));
    }, 1000);
    return () => window.clearInterval(id);
  }, [animate]);

  useEffect(() => {
    if (!animate) {
      setPlacedIds([DEMO_SEQUENCE[0]!.id]);
      setScore(scoreForCorrectPlacement(1));
      setStreak(1);
      return;
    }

    const stage = stageRef.current;
    const cursor = cursorRef.current;
    if (!stage || !cursor) return;

    const applyPlacement = (keywordIndex: number, isLast: boolean) => {
      const nextStreak = keywordIndex + 1;
      let delta = scoreForCorrectPlacement(nextStreak);
      if (isLast) delta += scoreForItemComplete();
      setStreak(nextStreak);
      setScore((value) => value + delta);
      scoreDeltaIdRef.current += 1;
      setScoreDelta({ id: scoreDeltaIdRef.current, value: delta });
      window.setTimeout(() => setScoreDelta(null), 900);
    };

    const context = gsap.context(() => {
      const timeline = gsap.timeline({ repeat: -1, repeatDelay: 1.1 });

      const findKeywordChip = (keywordText: string): HTMLElement | null =>
        (Array.from(stage.querySelectorAll("section button")).find((button) =>
          button.textContent?.includes(keywordText),
        ) as HTMLElement | undefined) ?? null;

      const findTargetWord = (keywordText: string): HTMLElement | null =>
        (Array.from(stage.querySelectorAll("article button")).find(
          (button) => button.textContent?.trim() === keywordText,
        ) as HTMLElement | undefined) ?? null;

      const resetRound = () => {
        setPlacedIds([]);
        setSelectedKeywordId(null);
        setDraggingKeywordId(null);
        setScore(0);
        setStreak(0);
        setScoreDelta(null);
      };

      timeline.call(resetRound);
      timeline.set(cursor, { opacity: 0 });

      DEMO_SEQUENCE.forEach((keyword, keywordIndex) => {
        timeline.call(() => {
          const chip = findKeywordChip(keyword.text);
          if (!chip) return;
          const { left, top } = getElementCenter(stage, chip);
          gsap.set(cursor, { left, top, opacity: 0 });
        });
        timeline.to(cursor, { opacity: 1, duration: 0.22 });

        timeline.call(() => {
          const chip = findKeywordChip(keyword.text);
          if (!chip) return;
          const ripple = cursor.querySelector<HTMLElement>("[data-demo-cursor-ripple]");
          if (ripple) {
            gsap
              .timeline()
              .set(ripple, { opacity: 0.85, scale: 0.35 })
              .to(ripple, { opacity: 0, scale: 2.2, duration: 0.35, ease: "power2.out" });
          }
          setSelectedKeywordId(keyword.id);
        });
        timeline.to({}, { duration: 0.35 });

        timeline.call(() => {
          setDraggingKeywordId(keyword.id);
          setSelectedKeywordId(null);
        });

        timeline.call(() => {
          const word = findTargetWord(keyword.text);
          if (!word) return;
          const { left, top } = getElementCenter(stage, word);
          gsap.to(cursor, {
            left,
            top,
            duration: 0.95,
            ease: DEMO_GSAP_EASE,
          });
        });
        timeline.to({}, { duration: 0.95 });

        timeline.call(() => {
          setPlacedIds((current) => [...new Set([...current, keyword.id])]);
          setDraggingKeywordId(null);
          setSelectedKeywordId(null);
          applyPlacement(
            keywordIndex,
            keywordIndex === DEMO_SEQUENCE.length - 1,
          );
        });
        timeline.to({}, { duration: 0.08 });

        timeline.call(() => {
          const ripple = cursor.querySelector<HTMLElement>("[data-demo-cursor-ripple]");
          if (ripple) {
            gsap
              .timeline()
              .set(ripple, { opacity: 0.85, scale: 0.35 })
              .to(ripple, { opacity: 0, scale: 2.2, duration: 0.35, ease: "power2.out" });
          }
        });
        timeline.to({}, { duration: 0.7 });
      });

      timeline.to(cursor, { opacity: 0, duration: 0.25 });
    }, stage);

    return () => context.revert();
  }, [animate]);

  return (
    <div
      ref={stageRef}
      className="ucat-product-ui pointer-events-none relative min-w-0 select-none overflow-hidden text-[#1a1a1a]"
      aria-hidden
    >
      <div className="space-y-2.5">
        <TrainerScoreBar
          remaining={remaining}
          score={score}
          streak={streak}
          scoreDelta={scoreDelta}
        />

        <div className="pointer-events-auto rounded-xl border border-black/10 bg-white p-2.5 shadow-sm sm:p-3">
          <FindWordTrainer
            content={HOSPITAL_FIND_WORD}
            shuffleKey="marketing-find-word"
            placedIds={placedIds}
            selectedKeywordId={selectedKeywordId}
            draggingKeywordId={draggingKeywordId}
            onSelectKeyword={() => {}}
            onDragKeyword={() => {}}
            disabled={false}
            onPlace={() => {}}
          />
        </div>
      </div>

      <DemoCursor cursorRef={cursorRef} />
      {draggingKeywordId ? (
        <KeywordDragGhost
          cursorRef={cursorRef}
          label={
            DEMO_SEQUENCE.find((keyword) => keyword.id === draggingKeywordId)
              ?.text ?? ""
          }
        />
      ) : null}
    </div>
  );
}
