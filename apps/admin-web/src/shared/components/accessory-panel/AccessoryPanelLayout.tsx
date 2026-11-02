"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
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
type DragWidth = {
  width: number;
  right: number;
  offset: number;
  maximum: number;
  pointerId: number;
};

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
  const setWidth = panel?.setWidth;
  const panelElement = useRef<HTMLElement>(null);
  const contentElement = useRef<HTMLDivElement>(null);
  const dividerElement = useRef<HTMLDivElement>(null);
  const drag = useRef<DragWidth | null>(null);
  const frame = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const docked =
    desktop &&
    availableWidth >= MIN_MAIN_WIDTH + MIN_DETAIL_WIDTH + DIVIDER_WIDTH;
  const maximumWidth = Math.max(
    MIN_DETAIL_WIDTH,
    availableWidth - MIN_MAIN_WIDTH - DIVIDER_WIDTH,
  );
  const actualWidth = Math.min(width, maximumWidth);
  const expanded = panel?.expanded ?? false;
  const collapse = panel?.collapse;

  const applyDragWidth = useCallback(() => {
    const width = drag.current?.width;
    if (width === undefined) return;
    if (panelElement.current) panelElement.current.style.width = `${width}px`;
    if (contentElement.current)
      contentElement.current.style.width = `${width}px`;
    dividerElement.current?.setAttribute(
      "aria-valuenow",
      String(Math.round(width)),
    );
  }, []);
  const finishDrag = useCallback(() => {
    const current = drag.current;
    if (!current) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    applyDragWidth();
    drag.current = null;
    setWidth?.(current.width);
    setDragging(false);
  }, [applyDragWidth, setWidth]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      drag.current = null;
    },
    [],
  );
  useEffect(() => {
    if (!expanded || !docked) finishDrag();
  }, [expanded, docked, finishDrag]);

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
    const observer = new ResizeObserver(([entry]) => {
      finishDrag();
      setAvailableWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [finishDrag]);

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
            ref={dividerElement}
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
              if (event.button !== 0 || !container.current) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              const right = container.current.getBoundingClientRect().right;
              drag.current = {
                width: actualWidth,
                right,
                offset: right - event.clientX - actualWidth,
                maximum: maximumWidth,
                pointerId: event.pointerId,
              };
              setDragging(true);
            }}
            onPointerMove={(event) => {
              const current = drag.current;
              if (!current || current.pointerId !== event.pointerId) return;
              current.width = Math.max(
                MIN_DETAIL_WIDTH,
                Math.min(
                  current.maximum,
                  current.right - event.clientX - current.offset,
                ),
              );
              if (frame.current !== null) return;
              frame.current = requestAnimationFrame(() => {
                frame.current = null;
                applyDragWidth();
              });
            }}
            onPointerUp={(event) => {
              finishDrag();
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={finishDrag}
            onLostPointerCapture={finishDrag}
            onKeyDown={(event) => {
              if (
                event.altKey ||
                event.metaKey ||
                event.ctrlKey ||
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const currentWidth = drag.current?.width ?? actualWidth;
              finishDrag();
              const next =
                event.key === "Home"
                  ? MIN_DETAIL_WIDTH
                  : event.key === "End"
                    ? maximumWidth
                    : currentWidth + (event.key === "ArrowLeft" ? 32 : -32);
              setWidth?.(
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
            panelElement.current = node;
            node?.toggleAttribute("inert", !expanded);
          }}
          data-expanded={expanded}
          data-docked={docked}
          className={`${styles.panel} overflow-hidden rounded-t-2xl bg-background ring-1 ring-border/70 ${docked ? "relative shrink-0" : "fixed bottom-0 right-0 top-[var(--navbar-height)] z-40 w-full shadow-xl"}`}
          style={{
            width: docked ? (expanded ? actualWidth : 0) : undefined,
            transition: dragging ? "none" : undefined,
          }}
        >
          <div
            ref={contentElement}
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
