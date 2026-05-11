"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useAppShellLayout } from "@/features/layout/context/app-shell-layout-context";
import { cn } from "@/lib/utils";

const TOOLBAR_ENTER_EASE = [0.32, 0.72, 0, 1] as const;

export type AppShellBottomFloatingDockProps = {
  visible: boolean;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  /** For product tours; applied to the surfaced panel */
  tourAnchorId?: string;
};

export function AppShellBottomFloatingDock({
  visible,
  children,
  className,
  innerClassName,
  tourAnchorId,
}: AppShellBottomFloatingDockProps) {
  const { mainContentHasSidebarInset } = useAppShellLayout();
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "fixed bottom-0 right-0 z-30 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2 transition-[left] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
        mainContentHasSidebarInset ? "left-[240px]" : "left-0",
        className,
      )}
    >
      <AnimatePresence>
        {visible ? (
          <motion.div
            key="app-shell-bottom-floating-dock"
            className="pointer-events-auto w-full max-w-5xl"
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 12 }}
            transition={{
              duration: reduceMotion ? 0 : 0.38,
              ease: TOOLBAR_ENTER_EASE,
            }}
          >
            <div
              {...(tourAnchorId ? { id: tourAnchorId } : {})}
              className={cn(
                "rounded-ucatShell border-0 bg-background/95 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-1 ring-[hsl(0_0%_0%/0.05)] backdrop-blur dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)] dark:ring-[hsl(0_0%_100%/0.07)]",
                "supports-[backdrop-filter]:bg-background/80",
                innerClassName,
              )}
            >
              {children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
