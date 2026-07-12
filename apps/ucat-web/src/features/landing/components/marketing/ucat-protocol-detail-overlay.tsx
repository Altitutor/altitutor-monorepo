"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  Clock3,
  Layers3,
  Target,
  Video,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import type { MouseEvent, RefObject } from "react";
import { LearningDetailStory } from "./protocol-details/learning-detail-story";
import { SkillDetailStory } from "./protocol-details/skill-detail-story";
import { PracticeDetailStory } from "./protocol-details/practice-detail-story";
import { SetsDetailStory } from "./protocol-details/sets-detail-story";
import { MocksDetailStory } from "./protocol-details/mocks-detail-story";
import { LiveDetailStory } from "./protocol-details/live-detail-story";
import { ProgressDetailStory } from "./protocol-details/progress-detail-story";

const { typography: typo } = MARKETING_TOKENS;

export type ProtocolFeatureKey =
  | "learning"
  | "skill"
  | "practice"
  | "sets"
  | "mocks"
  | "live"
  | "progress";

export type ProtocolFeatureOrigin = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const FEATURE_META = {
  learning: { label: "Learning modules", icon: BookOpen },
  skill: { label: "Skill trainers", icon: BrainCircuit },
  practice: { label: "Practice questions", icon: Target },
  sets: { label: "Question sets", icon: Layers3 },
  mocks: { label: "Mock exams", icon: Clock3 },
  live: { label: "Live online sessions", icon: Video },
  progress: { label: "Progress", icon: BarChart3 },
} as const;

function FeatureStory({ feature }: { feature: ProtocolFeatureKey }) {
  if (feature === "learning") return <LearningDetailStory />;
  if (feature === "skill") return <SkillDetailStory />;
  if (feature === "practice") return <PracticeDetailStory />;
  if (feature === "sets") return <SetsDetailStory />;
  if (feature === "mocks") return <MocksDetailStory />;
  if (feature === "live") return <LiveDetailStory />;
  return <ProgressDetailStory />;
}

export function ProtocolFeatureDetailContent({
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

  return (
    <div
      data-protocol-detail-back
      role="dialog"
      aria-modal="true"
      aria-labelledby={`protocol-detail-${feature}`}
      className="absolute inset-0 flex h-full w-full flex-col overflow-hidden bg-marketing-cream text-marketing-charcoal [backface-visibility:hidden] [transform:rotateY(180deg)]"
    >
      <div
        data-detail-scroll
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-marketing-primary/10 bg-marketing-cream/95 px-5 py-4 backdrop-blur-md sm:px-8">
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
  );
}

export function ProtocolFeatureDetailBackdrop({
  onDismiss,
}: {
  onDismiss: () => void;
}) {
  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onDismiss();
  };

  return createPortal(
    <div
      data-protocol-detail-backdrop
      className="fixed inset-0 z-[110] bg-marketing-charcoal/70 opacity-0 backdrop-blur-md"
      onMouseDown={handleMouseDown}
      aria-hidden="true"
    />,
    document.body,
  );
}
