"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { DialogScopeProvider, DialogScopePane, useMediaQuery } from "@altitutor/ui";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./accessory-panel.module.css";
import { ResponsivePane } from "@/shared/hooks/usePanelMediaQuery";
import { AccessoryTabs } from "@/shared/components/accessory-panel/AccessoryTabs";
import { useAccessoryPanel } from "@/shared/contexts/AccessoryPanelContext";

const MIN_DETAIL_WIDTH = 320;
const MIN_MAIN_WIDTH = 320;
const DIVIDER_WIDTH = 8;

export function AccessoryPanelLayout({ children }: { children: ReactNode }) {
  const panel = useAccessoryPanel();
  const desktop = useMediaQuery("(min-width: 768px)");
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const primaryHref = `${pathname}?${search}`;
  const previousPrimaryHref = useRef(primaryHref);
  const container = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const width = panel?.width ?? 520;
  const setWidth = panel?.setWidth ?? (() => {});
  const [dragging, setDragging] = useState(false);
  const docked =
    desktop && availableWidth >= MIN_MAIN_WIDTH + MIN_DETAIL_WIDTH + DIVIDER_WIDTH;
  const maximumWidth = Math.max(
    MIN_DETAIL_WIDTH,
    availableWidth - MIN_MAIN_WIDTH - DIVIDER_WIDTH,
  );
  const actualWidth = Math.min(width, maximumWidth);
  const expanded = panel?.expanded ?? false;
  const collapse = panel?.collapse;

  useEffect(() => {
    if (previousPrimaryHref.current !== primaryHref) {
      previousPrimaryHref.current = primaryHref;
      // Next links and browser history also navigate the primary pane, bypassing usePaneNavigation.
      if (!docked) collapse?.();
    }
  }, [primaryHref, docked, collapse]);

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setAvailableWidth(entry.contentRect.width),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const nav = document.querySelector("[data-admin-sidebar]");
    nav?.toggleAttribute("inert", expanded && !docked);
    return () => nav?.removeAttribute("inert");
  }, [expanded, docked]);

  useEffect(() => {
    if (!expanded || docked) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Let nested dialogs and popovers handle their own Escape first.
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !document.querySelector(
          '[role="dialog"], [role="alertdialog"], [data-radix-popper-content-wrapper]',
        )
      ) {
        panel?.collapse();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expanded, docked, panel]);

  return (
    <DialogScopeProvider>
      <div
        ref={container}
        className="relative flex min-w-0 flex-1 overflow-hidden"
      >
        <ResponsivePane
          inactive={expanded && !docked}
          className="flex-1 overflow-hidden"
        >
          <DialogScopePane>{children}</DialogScopePane>
        </ResponsivePane>
        {docked && (
          <div
            role="separator"
            tabIndex={expanded ? 0 : -1}
            aria-hidden={!expanded}
            style={{
              width: expanded ? 8 : 0,
              overflow: "hidden",
              transition: dragging ? "none" : undefined,
            }}
            aria-label="Resize accessory panel"
            aria-orientation="vertical"
            aria-controls="admin-accessory-panel"
            aria-valuemin={MIN_DETAIL_WIDTH}
            aria-valuemax={maximumWidth}
            aria-valuenow={Math.round(actualWidth)}
            className={`${styles.divider} group flex w-2 shrink-0 touch-none cursor-col-resize items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring`}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging(true);
            }}
            onPointerMove={(event) => {
              if (
                !event.currentTarget.hasPointerCapture(event.pointerId) ||
                !container.current
              )
                return;
              setWidth(
                Math.max(
                  MIN_DETAIL_WIDTH,
                  Math.min(
                    maximumWidth,
                    container.current.getBoundingClientRect().right -
                      event.clientX,
                  ),
                ),
              );
            }}
            onPointerUp={(event) => {
              event.currentTarget.releasePointerCapture(event.pointerId);
              setDragging(false);
            }}
            onLostPointerCapture={() => setDragging(false)}
            onKeyDown={(event) => {
              if (
                event.altKey ||
                event.metaKey ||
                event.ctrlKey ||
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? MIN_DETAIL_WIDTH
                  : event.key === "End"
                    ? maximumWidth
                    : actualWidth + (event.key === "ArrowLeft" ? 32 : -32);
              setWidth(
                Math.max(MIN_DETAIL_WIDTH, Math.min(maximumWidth, next)),
              );
            }}
          >
            <div className="h-12 w-0.5 rounded-full bg-border group-hover:bg-primary group-focus-visible:bg-primary" />
          </div>
        )}
        {/* Hiding, rather than unmounting, preserves tabs, drafts and scroll position. */}
        <aside
          id="admin-accessory-panel"
          aria-label="Accessory panel"
          aria-hidden={!expanded}
          ref={(node) => {
            node?.toggleAttribute("inert", !expanded);
          }}
          data-expanded={expanded}
          data-docked={docked}
          className={`${styles.panel} overflow-hidden rounded-t-2xl bg-background ring-1 ring-border/70 ${docked ? "relative shrink-0" : "fixed bottom-0 right-0 top-[var(--navbar-height)] z-40 w-full shadow-xl"}`}
          style={
            {
              "--detail-width": `${actualWidth}px`,
              transition: dragging ? "none" : undefined,
            } as CSSProperties
          }
        >
          <div
            className="h-full"
            style={docked ? { width: actualWidth } : undefined}
          >
            <AccessoryTabs />
          </div>
        </aside>
        {dragging && docked && (
          <div className="pointer-events-none absolute inset-0 z-50 select-none" />
        )}
      </div>
    </DialogScopeProvider>
  );
}
