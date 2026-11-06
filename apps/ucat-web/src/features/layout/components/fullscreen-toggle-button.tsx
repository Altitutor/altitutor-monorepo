"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { usePageFullscreen } from "@/features/layout/hooks/use-page-fullscreen";
import { UCAT_HEADER_ICON_BUTTON } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export function FullscreenToggleButton({
  presentation,
  showLabel = false,
}: {
  presentation: "icon" | "compact" | "detailed";
  showLabel?: boolean;
}) {
  const { supported, active, toggle, label } = usePageFullscreen();
  if (!supported) return null;

  const icon = active ? (
    <Minimize2 className="h-4 w-4" />
  ) : (
    <Maximize2 className="h-4 w-4" />
  );

  if (presentation === "icon") {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={UCAT_HEADER_ICON_BUTTON}
        aria-label={label}
        onClick={toggle}
      >
        {icon}
      </Button>
    );
  }

  if (presentation === "detailed") {
    return (
      <Button
        type="button"
        variant="ghost"
        className="w-full justify-start gap-2 px-2 hover:!bg-muted/80 hover:!text-foreground"
        aria-label={label}
        onClick={toggle}
      >
        {icon}
        {label}
      </Button>
    );
  }

  const button = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      className={cn(
        "group gap-1.5 transition-colors hover:!bg-muted hover:!text-foreground",
      )}
      onClick={toggle}
    >
      {icon}
      {showLabel ? <span>{label}</span> : null}
    </Button>
  );

  if (showLabel) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
