"use client";

import { useEffect, useRef, useState } from "react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { SegmentedControl } from "@altitutor/ui";
import { UcatAttemptReviewPreview } from "./ucat-attempt-review-preview";
import { UcatLearningPreview } from "./ucat-learning-preview";
import { UcatProgressPlanPreview } from "./ucat-progress-plan-preview";
import { UcatSimulatorPreview } from "./ucat-simulator-preview";
import { UcatStudyPlanPreview } from "./ucat-study-plan-preview";

const { typography: typo } = MARKETING_TOKENS;

const galleryItems = [
  { id: "learning", label: "Guided learning" },
  { id: "study-plan", label: "Study plan" },
  { id: "simulator", label: "UCAT simulator" },
  { id: "review", label: "Attempt review" },
  { id: "progress", label: "Progress" },
] as const;

type GalleryItemId = (typeof galleryItems)[number]["id"];

const AUTO_ROTATE_MS = 7000;
const POST_INTERACT_PAUSE_MS = 12_000;

/** Scoop radius for the notch's top shoulders (must match square + circle sizes). */
const SCOOP = "1.5rem";

function GalleryPreview({ activeItem }: { activeItem: GalleryItemId }) {
  switch (activeItem) {
    case "progress":
      return <UcatProgressPlanPreview />;
    case "study-plan":
      return <UcatStudyPlanPreview />;
    case "simulator":
      return <UcatSimulatorPreview />;
    case "review":
      return <UcatAttemptReviewPreview />;
    case "learning":
      return <UcatLearningPreview />;
    default: {
      const _exhaustive: never = activeItem;
      return _exhaustive;
    }
  }
}

/**
 * Round-out corners where the cream notch meets the hero:
 * a cream square beside the notch, cut by a primary circle so the
 * surviving quarter-circle reads as a scooped shoulder.
 */
function NotchShoulder({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";

  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 z-0 bg-marketing-cream"
        style={{
          width: SCOOP,
          height: SCOOP,
          ...(isLeft ? { left: `-${SCOOP}` } : { right: `-${SCOOP}` }),
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 z-[1] rounded-full bg-marketing-primary"
        style={{
          width: `calc(${SCOOP} * 2)`,
          height: `calc(${SCOOP} * 2)`,
          ...(isLeft
            ? { left: `calc(${SCOOP} * -2)` }
            : { right: `calc(${SCOOP} * -2)` }),
        }}
      />
    </>
  );
}

export function UcatProductStage() {
  const [activeItem, setActiveItem] = useState<GalleryItemId>("learning");
  const [isPointerOver, setIsPointerOver] = useState(false);
  const [pauseUntil, setPauseUntil] = useState(0);
  const leaveTimerRef = useRef<number | null>(null);

  const clearLeaveTimer = () => {
    if (leaveTimerRef.current != null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  const handlePointerEnter = () => {
    clearLeaveTimer();
    setIsPointerOver(true);
  };

  const handlePointerLeave = () => {
    clearLeaveTimer();
    leaveTimerRef.current = window.setTimeout(() => {
      setIsPointerOver(false);
      leaveTimerRef.current = null;
    }, 120);
  };

  useEffect(() => {
    return () => clearLeaveTimer();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;

    const tick = () => {
      if (isPointerOver) return;
      if (Date.now() < pauseUntil) return;
      setActiveItem((current) => {
        const index = galleryItems.findIndex((item) => item.id === current);
        const next = galleryItems[(index + 1) % galleryItems.length];
        return next!.id;
      });
    };

    const id = window.setInterval(tick, AUTO_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [isPointerOver, pauseUntil]);

  const handleTabChange = (value: GalleryItemId) => {
    setActiveItem(value);
    setPauseUntil(Date.now() + POST_INTERACT_PAUSE_MS);
  };

  return (
    <section
      id="product"
      className="relative scroll-mt-24 bg-marketing-primary px-3 pb-24 text-white sm:px-6 sm:pb-28"
    >
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -left-32 top-0 size-[32rem] rounded-full bg-[#355d72] blur-[130px]" />
        <div className="absolute -right-24 bottom-0 size-[28rem] rounded-full bg-marketing-accent/18 blur-[120px]" />
      </div>

      {/* Cream notch: continuous with hero cream — no top shadow/seam */}
      <div
        className="relative z-20 mx-auto -mt-px w-fit max-w-[calc(100%-0.5rem)]"
        onMouseEnter={handlePointerEnter}
        onMouseLeave={handlePointerLeave}
        onFocusCapture={handlePointerEnter}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            handlePointerLeave();
          }
        }}
      >
        <div className="relative rounded-b-[2rem] bg-marketing-cream px-3 pb-5 pt-1 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.2)] sm:rounded-b-[2.5rem] sm:px-6 sm:pb-6">
          {/* Cover the hero junction so subpixel gaps can't show through */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-1 h-1 bg-marketing-cream"
          />
          <NotchShoulder side="left" />
          <NotchShoulder side="right" />

          <SegmentedControl
            value={activeItem}
            onValueChange={handleTabChange}
            options={galleryItems.map((item) => ({
              value: item.id,
              label: item.label,
            }))}
            variant="light"
            aria-label="Explore Altitutor UCAT"
            className={`relative z-[2] max-w-full bg-transparent text-sm font-semibold tracking-tight ring-0 [--radius:9999px] md:text-base md:[&_button]:px-4 md:[&_button]:py-2.5 ${typo.headingSans}`}
          />
        </div>
      </div>

      <div
        className="relative mx-auto mt-7 w-full max-w-[92rem] sm:mt-9"
        onMouseEnter={handlePointerEnter}
        onMouseLeave={handlePointerLeave}
      >
        <div
          role="tabpanel"
          aria-label={
            galleryItems.find((item) => item.id === activeItem)?.label
          }
          className="h-[35rem] overflow-hidden rounded-[1.25rem] bg-[#f6f7f9] shadow-[0_28px_90px_rgba(0,0,0,0.26)] ring-1 ring-white/15 sm:h-[42rem] lg:h-[46rem] xl:h-[50rem]"
        >
          <div
            key={activeItem}
            className="h-full min-h-0 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            <GalleryPreview activeItem={activeItem} />
          </div>
        </div>
      </div>
    </section>
  );
}
