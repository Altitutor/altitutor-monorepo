"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useUcatInterfacePreferences } from "@/features/interface-preferences/hooks/use-ucat-interface-preferences";
import { isQuestionEngineTutorialPath } from "@/features/onboarding/lib/question-engine-tutorial-gate";
import type { ExamToolbarLayout } from "@/features/interface-preferences/model/types";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { cn } from "@/lib/utils";

export function UcatFloatingToolbar({
  tutorialToolbarVisible = false,
  tutorialToolbarLayout = "compact_top",
  onTutorialToolbarVisibleChange,
}: {
  tutorialToolbarVisible?: boolean;
  tutorialToolbarLayout?: ExamToolbarLayout;
  onTutorialToolbarVisibleChange?: (visible: boolean) => void;
}) {
  const tutorial = isQuestionEngineTutorialPath(usePathname());
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { preferences, updatePreferences } = useUcatInterfacePreferences();
  const compact =
    isMobile ||
    (tutorial
      ? tutorialToolbarLayout === "compact_top"
      : preferences.examToolbarLayout === "compact_top");
  const toolbarVisible = tutorial
    ? tutorialToolbarVisible
    : preferences.examToolbarVisible;
  const topToolbarVisible = compact && toolbarVisible;
  const rightToolbarVisible = !compact && toolbarVisible;
  const toggleLabel = toolbarVisible ? "Hide toolbar" : "Show toolbar";

  return (
    <div
      className={cn(
        "pointer-events-none fixed left-0 z-[70] flex justify-center transition-[top,right] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
        topToolbarVisible ? "top-14" : "top-2",
        rightToolbarVisible ? "right-64" : "right-0",
      )}
    >
      <div className="pointer-events-auto">
        <button
          type="button"
          data-tour="question-engine-menu"
          title={toggleLabel}
          aria-label={toggleLabel}
          aria-pressed={toolbarVisible}
          onClick={() => {
            if (tutorial) {
              onTutorialToolbarVisibleChange?.(!toolbarVisible);
              return;
            }
            void updatePreferences({
              examToolbarVisible: !preferences.examToolbarVisible,
            });
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-background/95 px-3 text-sm shadow-md backdrop-blur transition-[box-shadow,transform,opacity] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-lg active:scale-95"
        >
          <Menu className="h-4 w-4" />
          <span className="sr-only min-[700px]:not-sr-only">Menu</span>
        </button>
      </div>
    </div>
  );
}
