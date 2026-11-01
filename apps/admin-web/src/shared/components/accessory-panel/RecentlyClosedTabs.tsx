"use client";

import { Button } from "@altitutor/ui";
import { useAccessoryPanel } from "@/shared/contexts/AccessoryPanelContext";
import { AccessoryIcon } from "./AccessoryIcon";

export function RecentlyClosedTabs() {
  const panel = useAccessoryPanel();
  if (!panel) return null;
  return (
    <div className="w-full max-w-xs space-y-2 text-left">
      <h3 className="px-3 text-xs font-medium text-muted-foreground">
        Recently closed
      </h3>
      {!panel.recentlyClosed.length && <p className="px-3 text-sm text-muted-foreground">No recently closed records.</p>}
      {panel.recentlyClosed.map((tab) => (
        <Button
          key={tab.key}
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={() => panel.openTab(tab)}
        >
          <AccessoryIcon kind={tab.kind} className="h-4 w-4 shrink-0" />
          <span className="truncate">{tab.title}</span>
        </Button>
      ))}
    </div>
  );
}
