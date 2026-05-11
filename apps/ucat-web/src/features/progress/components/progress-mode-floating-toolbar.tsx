"use client";

import { AppShellBottomFloatingDock } from "@/features/layout/components/app-shell-bottom-floating-dock";
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
  return (
    <AppShellBottomFloatingDock visible tourAnchorId={tourAnchorId} className={className}>
      <ProgressModeSelector {...selectorProps} className="w-full min-w-0" />
    </AppShellBottomFloatingDock>
  );
}
