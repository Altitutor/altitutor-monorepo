'use client';

import type { ReactNode } from 'react';
import { ResponsiveResizablePanels } from '@altitutor/ui';

interface EntityResizablePanelsProps {
  id: string;
  main: ReactNode;
  sidebar: ReactNode;
}

export function EntityResizablePanels({
  id,
  main,
  sidebar,
}: EntityResizablePanelsProps) {
  return (
    <ResponsiveResizablePanels
      id={id}
      primary={main}
      secondary={sidebar}
      primaryMinSize={480}
      secondaryMinSize={280}
      secondaryMaxSize={520}
      handleLabel="Resize details sidebar"
    />
  );
}
