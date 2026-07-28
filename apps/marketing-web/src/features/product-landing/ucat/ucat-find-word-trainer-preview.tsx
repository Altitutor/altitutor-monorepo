"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { gsap } from "gsap";
import { FindWordTrainer } from "@altitutor/ui";
import type { FindWordItemContent } from "@altitutor/shared";
import { Clock3, Flame, Trophy } from "lucide-react";
import clsx from "clsx";
import { DemoCursor, DEMO_EASE } from "./demo-stage";

const DEMO_GSAP_EASE = `cubic-bezier(${DEMO_EASE.join(", ")})`;

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
            text: "The hospital opened a new wing. Nurses trained on the ward daily. Dr Patel led the pilot.",
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

const DEMO_KEYWORD = HOSPITAL_FIND_WORD.keywords[1]!;

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
      className="pointer-events-none absolute left-0 top-0 z-40 rounded-md border border-primary/40 bg-background px-3 py-2 text-sm font-medium shadow-md opacity-0"
    >
      {label}
    </span>
  );
}

function ScorePill({
  icon: Icon,
  value,
  iconClassName,
}: {
  icon: typeof Trophy;
  value: string | number;
  iconClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm shadow-sm">
      <Icon className={clsx("size-3.5 shrink-0 text-black/45", iconClassName)} aria-hidden />
      <span className="font-bold tabular-nums">{value}</span>
    </span>
  );
}

export function MarketingFindWordTrainerPreview({ animate }: { animate: boolean }) {
  const [placedIds, setPlacedIds] = useState<string[]>([]);
  const [selectedKeywordId, setSelectedKeywordId] = useState<string | null>(null);
  const [draggingKeywordId, setDraggingKeywordId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(42);
  const stageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => {
      setRemaining((value) => (value <= 4 ? 42 : value - 4));
    }, 1000);
    return () => window.clearInterval(id);
  }, [animate]);

  useEffect(() => {
    if (!animate) {
      setPlacedIds([DEMO_KEYWORD.id]);
      return;
    }

    const stage = stageRef.current;
    const cursor = cursorRef.current;
    if (!stage || !cursor) return;

    const context = gsap.context(() => {
      const timeline = gsap.timeline({ repeat: -1, repeatDelay: 1.4 });

      const findKeywordChip = (): HTMLElement | null =>
        (Array.from(stage.querySelectorAll("section button")).find((button) =>
          button.textContent?.includes(DEMO_KEYWORD.text),
        ) as HTMLElement | undefined) ?? null;

      const findTargetWord = (): HTMLElement | null =>
        (Array.from(stage.querySelectorAll("article button")).find(
          (button) => button.textContent?.trim() === DEMO_KEYWORD.text,
        ) as HTMLElement | undefined) ?? null;

      timeline.call(() => {
        setPlacedIds([]);
        setSelectedKeywordId(null);
        setDraggingKeywordId(null);
      });
      timeline.set(cursor, { opacity: 0 });

      timeline.call(() => {
        const chip = findKeywordChip();
        if (!chip) return;
        const { left, top } = getElementCenter(stage, chip);
        gsap.set(cursor, { left, top, opacity: 0 });
      });
      timeline.to(cursor, { opacity: 1, duration: 0.22 });

      timeline.call(() => {
        const chip = findKeywordChip();
        if (!chip) return;
        const ripple = cursor.querySelector<HTMLElement>("[data-demo-cursor-ripple]");
        if (ripple) {
          gsap
            .timeline()
            .set(ripple, { opacity: 0.85, scale: 0.35 })
            .to(ripple, { opacity: 0, scale: 2.2, duration: 0.35, ease: "power2.out" });
        }
        setSelectedKeywordId(DEMO_KEYWORD.id);
      });
      timeline.to({}, { duration: 0.35 });

      timeline.call(() => {
        setDraggingKeywordId(DEMO_KEYWORD.id);
        setSelectedKeywordId(null);
      });

      timeline.call(() => {
        const word = findTargetWord();
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
        setPlacedIds([DEMO_KEYWORD.id]);
        setDraggingKeywordId(null);
        setSelectedKeywordId(null);
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
      timeline.to({}, { duration: 1.6 });
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
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <ScorePill icon={Trophy} value={8} />
          <ScorePill icon={Flame} value={2} iconClassName="text-orange-500" />
          <ScorePill icon={Clock3} value={`${remaining}s`} />
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-3 shadow-sm sm:p-4">
          <FindWordTrainer
            content={HOSPITAL_FIND_WORD}
            shuffleKey="marketing-find-word"
            placedIds={placedIds}
            selectedKeywordId={selectedKeywordId}
            draggingKeywordId={draggingKeywordId}
            onSelectKeyword={() => {}}
            onDragKeyword={() => {}}
            disabled
            onPlace={() => {}}
          />
        </div>
      </div>

      <DemoCursor cursorRef={cursorRef} />
      {draggingKeywordId ? (
        <KeywordDragGhost cursorRef={cursorRef} label={DEMO_KEYWORD.text} />
      ) : null}
    </div>
  );
}
