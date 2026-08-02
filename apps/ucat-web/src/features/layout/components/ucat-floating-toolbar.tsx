"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Eye, EyeOff, LogOut, Menu } from "lucide-react";
import { useExamExperience } from "@/features/exam-experience/context/exam-experience-context";
import { useUcatInterfacePreferences } from "@/features/interface-preferences/hooks/use-ucat-interface-preferences";
import { cn } from "@/lib/utils";

export function UcatFloatingToolbar() {
  const [open, setOpen] = useState(false);
  const tutorial = usePathname() === "/exam/tutorial";
  const { requestExit } = useExamExperience();
  const { preferences, updatePreferences } = useUcatInterfacePreferences();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[70] flex justify-center">
      <div className="pointer-events-auto relative">
        <button
          type="button"
          data-tour="question-engine-menu"
          title="Session menu"
          aria-label="Session menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-background/95 px-3 text-sm shadow-md backdrop-blur transition-[box-shadow,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-lg active:scale-95"
        >
          <Menu className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only">Session</span>
        </button>
        <div
          className={cn(
            "absolute left-1/2 top-11 w-52 -translate-x-1/2 rounded-lg bg-card p-1 text-sm text-card-foreground shadow-lg transition-[opacity,transform,visibility] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
            open
              ? "visible translate-y-0 scale-100 opacity-100"
              : "invisible pointer-events-none -translate-y-1 scale-95 opacity-0",
          )}
        >
          <button
            type="button"
            disabled={tutorial}
            className="flex h-9 w-full items-center rounded-md px-2 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              setOpen(false);
              void updatePreferences({
                examToolbarVisible: !preferences.examToolbarVisible,
              });
            }}
          >
            {preferences.examToolbarVisible ? (
              <EyeOff className="mr-2 h-4 w-4" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {tutorial
              ? "Toolbar always shown"
              : preferences.examToolbarVisible
                ? "Hide toolbar"
                : "Show toolbar"}
          </button>
          <button
            type="button"
            className="flex h-9 w-full items-center rounded-md px-2 text-left text-destructive hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              setOpen(false);
              requestExit();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Exit session
          </button>
        </div>
      </div>
    </div>
  );
}
