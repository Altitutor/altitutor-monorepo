"use client";

import { useState, type ReactNode } from "react";
import { Button, ResponsiveResizablePanels, useMediaQuery } from "@altitutor/ui";
import { PanelRight, X } from "lucide-react";
import { AdminPageActions } from "@/shared/components/AdminPageActions";

interface EntityResizablePanelsProps {
  id: string;
  main: ReactNode;
  sidebar: ReactNode;
  primaryMinSize?: number;
  secondaryMinSize?: number;
}

/** Desktop keeps a resizable properties column. Narrow screens hide it until the header button opens it, so the column cannot cover the record. */
export function EntityResizablePanels({
  id,
  main,
  sidebar,
  primaryMinSize = 480,
  secondaryMinSize = 280,
}: EntityResizablePanelsProps) {
  const wide = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useState(false);
  if (!wide) {
    return (
      <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <AdminPageActions priority="secondary">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            aria-label="Right sidebar"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <PanelRight className="h-4 w-4" />
          </Button>
        </AdminPageActions>
        <div className="min-h-0 flex-1 overflow-hidden">{main}</div>
        {open ? (
          <div
            className="absolute inset-0 z-30 flex justify-end bg-black/20"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-label="Right sidebar"
              className="flex h-full w-[min(100%,24rem)] min-w-0 flex-col border-l bg-background shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex justify-end border-b p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Close sidebar"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">{sidebar}</div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <ResponsiveResizablePanels
      id={id}
      primary={main}
      secondary={sidebar}
      primaryMinSize={primaryMinSize}
      secondaryMinSize={secondaryMinSize}
      secondaryMaxSize={520}
      handleLabel="Resize details sidebar"
    />
  );
}
