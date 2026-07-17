"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { BarChart3, BookOpen, Clock3, Target, X } from "lucide-react";
import { createPortal } from "react-dom";
import type { MouseEvent, RefObject } from "react";
import { LearningDetailStory } from "./protocol-details/learning-detail-story";
import { MocksDetailStory } from "./protocol-details/mocks-detail-story";
import { PracticeDetailStory } from "./protocol-details/practice-detail-story";
import { ProgressDetailStory } from "./protocol-details/progress-detail-story";

const { typography: typo } = MARKETING_TOKENS;

export type ProtocolFeatureKey = "learning" | "practice" | "mocks" | "progress";

const FEATURE_META = {
  learning: { label: "Learn", icon: BookOpen },
  practice: { label: "Practice tools", icon: Target },
  mocks: { label: "Mock exam simulation", icon: Clock3 },
  progress: { label: "Progress tracking", icon: BarChart3 },
} as const;

function FeatureStory({ feature }: { feature: ProtocolFeatureKey }) {
  if (feature === "learning") return <LearningDetailStory />;
  if (feature === "practice") return <PracticeDetailStory />;
  if (feature === "mocks") return <MocksDetailStory />;
  return <ProgressDetailStory />;
}

export function ProtocolFeatureDetailModal({
  feature,
  closeButtonRef,
  onDismiss,
}: {
  feature: ProtocolFeatureKey;
  closeButtonRef: RefObject<HTMLButtonElement>;
  onDismiss: () => void;
}) {
  const meta = FEATURE_META[feature];
  const Icon = meta.icon;

  const stopPropagation = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6">
      <div
        data-protocol-detail-backdrop
        className="absolute inset-0 bg-marketing-charcoal/70 opacity-0 backdrop-blur-md"
        onMouseDown={onDismiss}
        aria-hidden="true"
      />
      <div
        data-protocol-detail-modal
        role="dialog"
        aria-modal="true"
        aria-labelledby={`protocol-detail-${feature}`}
        onMouseDown={stopPropagation}
        className="relative z-10 h-[calc(100dvh-1.5rem)] w-full max-w-6xl overflow-hidden rounded-[1.75rem] border border-white/15 bg-marketing-cream text-marketing-charcoal opacity-0 shadow-[0_32px_100px_rgba(0,0,0,0.32)] sm:h-[calc(100dvh-3rem)] sm:rounded-[2.5rem]"
      >
        <div
          data-detail-scroll
          className="h-full overflow-y-auto overscroll-contain"
        >
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-marketing-primary/10 bg-marketing-cream/95 px-5 py-4 backdrop-blur-md sm:px-8">
            <div className="flex items-center gap-3 text-marketing-primary">
              <Icon className="h-5 w-5" />
              <span
                className={`text-[11px] font-bold uppercase tracking-[0.18em] ${typo.dataMono}`}
              >
                {meta.label}
              </span>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onDismiss}
              className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-marketing-charcoal transition-colors hover:bg-marketing-primary/5 hover:text-marketing-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marketing-accent"
              aria-label={`Close ${meta.label} details`}
            >
              Close <X className="h-5 w-5" />
            </button>
          </div>
          <FeatureStory feature={feature} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
