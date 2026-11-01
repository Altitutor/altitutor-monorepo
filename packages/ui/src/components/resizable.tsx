"use client";

import * as React from "react";
import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type PanelProps,
  type SeparatorProps,
} from "react-resizable-panels";

import { cn } from "../lib/cn";
import { useMediaQuery } from "../hooks/use-media-query";
import {
  bindPanelResizeRelease,
  ensurePanelResizeGuardInstalled,
  markPanelResizeActive,
} from "../lib/panel-resize-guard";

function ResizablePanelGroup({ className, ...props }: GroupProps) {
  React.useEffect(() => {
    ensurePanelResizeGuardInstalled();
  }, []);

  return <Group className={cn("flex h-full w-full", className)} {...props} />;
}

function ResizablePanel(props: PanelProps) {
  return <Panel {...props} />;
}

function ResizableHandle({
  className,
  onPointerDownCapture,
  ...props
}: SeparatorProps) {
  const handlePointerDownCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const handle = event.currentTarget;
      markPanelResizeActive(handle);
      bindPanelResizeRelease(handle);
      onPointerDownCapture?.(event);
    },
    [onPointerDownCapture],
  );

  return (
    <Separator
      onPointerDownCapture={handlePointerDownCapture}
      className={cn(
        "group relative flex w-px shrink-0 items-center justify-center bg-transparent",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2",
        "hover:bg-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        className,
      )}
      {...props}
    >
      <span className="z-10 h-8 w-1 rounded-full bg-transparent transition-colors group-hover:bg-primary/50" />
    </Separator>
  );
}

const BREAKPOINT_QUERIES = {
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
} as const;

interface ResponsiveResizablePanelsProps {
  id: string;
  primary: React.ReactNode;
  secondary: React.ReactNode;
  mobilePanel?: "primary" | "secondary";
  breakpoint?: keyof typeof BREAKPOINT_QUERIES;
  stackOnNarrow?: boolean;
  primaryDefaultSize?: number | string;
  primaryMinSize: number | string;
  primaryMaxSize?: number | string;
  secondaryDefaultSize?: number | string;
  secondaryMinSize: number | string;
  secondaryMaxSize?: number | string;
  handleLabel: string;
}

function ResponsiveResizablePanels({
  id,
  primary,
  secondary,
  mobilePanel = "primary",
  breakpoint = "md",
  stackOnNarrow = false,
  primaryDefaultSize = "65%",
  primaryMinSize,
  primaryMaxSize,
  secondaryDefaultSize = 320,
  secondaryMinSize,
  secondaryMaxSize,
  handleLabel,
}: ResponsiveResizablePanelsProps) {
  const isResizable = useMediaQuery(BREAKPOINT_QUERIES[breakpoint]);

  const stacked = !isResizable && stackOnNarrow;
  if (!isResizable && !stackOnNarrow) {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
        {mobilePanel === "primary" ? primary : secondary}
      </div>
    );
  }

  // Keep editors mounted when a pane crosses the breakpoint. Replacing the whole
  // layout tree rebuilds rich text and large linked-record lists during a drag.
  const stackedPanel = stacked
    ? "!flex-none !h-auto !min-h-0 !overflow-visible [&>.h-full]:h-auto [&>.h-full]:overflow-visible [&_.overscroll-contain]:overflow-visible [&_.overscroll-contain]:overscroll-auto"
    : undefined;

  return (
    <ResizablePanelGroup
      id={id}
      orientation="horizontal"
      disabled={stacked}
      className={
        stacked
          ? "!flex-col !overflow-y-auto !overflow-x-hidden overscroll-contain pb-20"
          : undefined
      }
    >
      <ResizablePanel
        id={`${id}-primary`}
        defaultSize={primaryDefaultSize}
        minSize={stacked ? 0 : primaryMinSize}
        maxSize={stacked ? undefined : primaryMaxSize}
        className={cn("min-w-0", stackedPanel)}
      >
        {primary}
      </ResizablePanel>
      <ResizableHandle
        id={`${id}-handle`}
        aria-label={handleLabel}
        disabled={stacked}
        className={stacked ? "hidden" : undefined}
      />
      <ResizablePanel
        id={`${id}-secondary`}
        defaultSize={secondaryDefaultSize}
        minSize={stacked ? 0 : secondaryMinSize}
        maxSize={stacked ? undefined : secondaryMaxSize}
        className={cn("min-w-0", stackedPanel)}
      >
        {secondary}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export {
  ResponsiveResizablePanels,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
};

if (typeof window !== "undefined") {
  ensurePanelResizeGuardInstalled();
}
