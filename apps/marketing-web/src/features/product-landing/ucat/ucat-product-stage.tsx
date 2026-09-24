"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  SegmentedControl,
} from "@altitutor/ui";
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

const labelClassName =
  "truncate text-center text-sm font-semibold tracking-tight sm:text-base";

const AUTO_ROTATE_MS = 7000;
const POST_INTERACT_PAUSE_MS = 12_000;

/** Scoop radius where the cream notch meets the hero. */
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

function wrapGalleryIndex(index: number) {
  return (
    ((index % galleryItems.length) + galleryItems.length) % galleryItems.length
  );
}

function GalleryCarouselSwitcher({
  activeItem,
  onChange,
}: {
  activeItem: GalleryItemId;
  onChange: (value: GalleryItemId) => void;
}) {
  const activeIndex = galleryItems.findIndex((item) => item.id === activeItem);
  const activeLabel = galleryItems[activeIndex]?.label ?? "";

  const goToOffset = (offset: number) => {
    const next = galleryItems[wrapGalleryIndex(activeIndex + offset)];
    if (next) onChange(next.id);
  };

  const arrowButtonClass =
    "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-black/40 transition-colors hover:bg-black/[0.07] hover:text-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15";

  return (
    <div
      className={`relative z-[2] grid grid-cols-[auto_auto_auto] items-center gap-2 px-1 sm:gap-3 ${typo.headingSans}`}
      role="tablist"
      aria-label="Explore Altitutor UCAT"
    >
      <button
        type="button"
        className={arrowButtonClass}
        aria-label="Previous feature"
        onClick={() => goToOffset(-1)}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>

      <div className="relative grid min-w-0 [&>*]:col-start-1 [&>*]:row-start-1">
        {galleryItems.map((item) => (
          <span
            key={item.id}
            aria-hidden
            className={`invisible ${labelClassName}`}
          >
            {item.label}
          </span>
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              role="tab"
              aria-selected
              aria-haspopup="menu"
              className={`group relative flex w-full items-center justify-center rounded-md text-black transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 ${labelClassName}`}
            >
              {activeLabel}
              <ChevronDown
                className="pointer-events-none absolute right-0 size-3.5 text-black/35 transition-colors group-hover:text-black/55 group-data-[state=open]:text-black/55"
                aria-hidden
              />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="center"
            className="min-w-[14rem] rounded-xl border-black/10 bg-white p-1 text-marketing-charcoal shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
          >
            <DropdownMenuLabel
              className={`px-2 py-1.5 text-xs font-medium text-black/50 ${typo.secondarySans}`}
            >
              Select a feature to explore
            </DropdownMenuLabel>

            {galleryItems.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onSelect={() => onChange(item.id)}
                className={`rounded-lg px-2 py-2 text-sm font-medium focus:bg-black/[0.04] ${typo.headingSans}`}
              >
                <span className="flex-1">{item.label}</span>
                {item.id === activeItem ? (
                  <Check className="size-4 text-marketing-primary" aria-hidden />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <button
        type="button"
        className={arrowButtonClass}
        aria-label="Next feature"
        onClick={() => goToOffset(1)}
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/**
 * Concave corner beside the notch. Cream is the fill; the quarter-circle
 * is a hole, so the mountain background shows through instead of a painted
 * circle that has to match the section colour.
 */
function NotchShoulder({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";

  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="pointer-events-none absolute top-0 block text-marketing-cream"
      style={{
        width: SCOOP,
        height: SCOOP,
        // Overlap the cream bar so the path's vertical edge anti-aliases
        // over cream, not over the mountain (which reads as a grey hairline).
        ...(isLeft
          ? { left: `calc(-${SCOOP} + 2px)` }
          : { right: `calc(-${SCOOP} + 2px)` }),
      }}
    >
      <path
        fill="currentColor"
        d={
          isLeft
            ? "M0 0h24v24A24 24 0 0 0 0 0z"
            : "M24 0H0v24A24 24 0 0 1 24 0z"
        }
      />
    </svg>
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
      className="relative scroll-mt-24 overflow-hidden bg-marketing-primary px-4 pb-20 text-white sm:px-8 sm:pb-24"
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-70"
        aria-hidden
      >
        <Image
          src="/images/landing/background-alt-scaled.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a2941] via-[#0a2941]/60 to-[#0a2941]/10" />
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

          <div className="lg:hidden">
            <GalleryCarouselSwitcher
              activeItem={activeItem}
              onChange={handleTabChange}
            />
          </div>

          <SegmentedControl
            value={activeItem}
            onValueChange={handleTabChange}
            options={galleryItems.map((item) => ({
              value: item.id,
              label: item.label,
            }))}
            variant="light"
            aria-label="Explore Altitutor UCAT"
            className={`relative z-[2] hidden max-w-full overflow-x-visible bg-transparent text-sm font-semibold tracking-tight shadow-none ring-0 ring-transparent [--radius:9999px] lg:inline-flex md:text-base md:[&_button]:px-4 md:[&_button]:py-2.5 ${typo.headingSans}`}
          />
        </div>
      </div>

      <div
        className="relative z-10 mx-auto mt-7 w-full max-w-6xl sm:mt-9"
        onMouseEnter={handlePointerEnter}
        onMouseLeave={handlePointerLeave}
      >
        <div
          role="tabpanel"
          aria-label={
            galleryItems.find((item) => item.id === activeItem)?.label
          }
          className="h-[28rem] overflow-hidden rounded-[1.25rem] bg-[#f6f7f9] shadow-[0_28px_90px_rgba(0,0,0,0.26)] ring-1 ring-white/15 sm:h-[34rem] lg:aspect-[16/10] lg:h-auto"
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
