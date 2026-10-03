"use client";

import type { ReactNode } from "react";
import { ResponsiveResizablePanels } from "@altitutor/ui";

interface EntityResizablePanelsProps {
  id: string;
  main: ReactNode;
  sidebar: ReactNode;
  primaryMinSize?: number;
  secondaryMinSize?: number;
}

export function EntityResizablePanels({
  id,
  main,
  sidebar,
  primaryMinSize = 480,
  secondaryMinSize = 280,
}: EntityResizablePanelsProps) {
  return (
    <ResponsiveResizablePanels
      id={id}
      stackOnNarrow
      primary={main}
      secondary={sidebar}
      primaryMinSize={primaryMinSize}
      secondaryMinSize={secondaryMinSize}
      secondaryMaxSize={520}
      handleLabel="Resize details sidebar"
    />
  );
}
