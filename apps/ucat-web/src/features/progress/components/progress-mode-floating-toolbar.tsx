"use client";

import { useAppShellLayout } from "@/features/layout/context/app-shell-layout-context";
import { cn } from "@/lib/utils";
import {
  ProgressModeSelector,
  type ProgressModeSelectorProps,
} from "./progress-mode-selector";

type ProgressModeFloatingToolbarProps = ProgressModeSelectorProps & {
  /** For product tours; rendered on the fixed anchor wrapper */
  tourAnchorId?: string;
};

export function ProgressModeFloatingToolbar({
  tourAnchorId,
  className,
  ...selectorProps
}: ProgressModeFloatingToolbarProps) {
  const { mainContentHasSidebarInset } = useAppShellLayout();

  return (
    <div
      className={cn(
        "fixed bottom-0 right-0 z-30 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2 transition-[left] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
        mainContentHasSidebarInset ? "left-[240px]" : "left-0",
        className,
      )}
    >
      <div
        {...(tourAnchorId ? { id: tourAnchorId } : {})}
        className={cn(
          "w-full max-w-5xl rounded-xl border border-border/50 bg-background/95 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur",
          "supports-[backdrop-filter]:bg-background/80 dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)]",
        )}
      >
        <ProgressModeSelector {...selectorProps} className="w-full min-w-0" />
      </div>
    </div>
  );
}
