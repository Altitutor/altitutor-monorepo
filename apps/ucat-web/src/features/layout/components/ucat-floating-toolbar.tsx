"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, Settings } from "lucide-react";
import { useUcatLag } from "@/features/question-engine/context/ucat-lag-context";
import { cn } from "@/lib/utils";

export function UcatFloatingToolbar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { enabled: lagEnabled, setEnabled: setLagEnabled } = useUcatLag();

  const handleGoHome = () => {
    const confirmLeave = window.confirm(
      "Are you sure you want to leave this UCAT exam? Your current progress may be lost.",
    );
    if (!confirmLeave) {
      return;
    }

    setMenuOpen(false);
    router.push("/");
  };

  const handleSettingsClick = () => {
    setSettingsOpen((prev) => !prev);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[60] flex justify-center">
      <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1 text-sm shadow-md transition-shadow duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-lg">
        <div className="relative flex items-center gap-1">
          <button
            type="button"
            title="Open menu"
            aria-label="Open menu"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent bg-transparent text-foreground transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-muted/50 active:scale-95"
          >
            <Menu className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Open settings"
            aria-label="Open settings"
            onClick={handleSettingsClick}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent bg-transparent text-foreground transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-muted/50 active:scale-95"
          >
            <Settings className="h-4 w-4" />
          </button>

          <div
            className={cn(
              "absolute left-1/2 top-9 z-[61] -translate-x-1/2 rounded-md border bg-background text-xs shadow-lg",
              menuOpen ? "block" : "hidden",
            )}
          >
            <button
              type="button"
              className="block w-full px-3 py-1.5 text-left transition-colors duration-150 ease-out hover:bg-muted"
              onClick={handleGoHome}
            >
              Go home
            </button>
          </div>

          <div
            className={cn(
              "absolute right-0 top-9 z-[61] mt-1 w-56 rounded-md border bg-background text-xs shadow-lg",
              settingsOpen ? "block" : "hidden",
            )}
          >
            <div className="px-3 py-2">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                UCAT settings
              </div>
              <label className="flex items-center justify-between gap-3 py-1 text-[11px]">
                <span>Lag mode</span>
                <span className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    className="h-3 w-3"
                    checked={lagEnabled}
                    onChange={(event) => setLagEnabled(event.target.checked)}
                  />
                  <span>Simulate lag</span>
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
