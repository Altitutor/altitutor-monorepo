"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Button,
  ResponsiveResizablePanels,
} from "@altitutor/ui";
import { PanelRight, X } from "lucide-react";
import styles from "./entity-properties-layout.module.css";

type PropertiesState = {
  narrow: boolean;
  id: string;
  setAnimate: (animate: boolean) => void;
  expanded: boolean;
  toggleExpanded?: () => void;
};
const PropertiesContext = createContext<PropertiesState | null>(null);

/** The same control is placed in each record's own header, including accessory records. */
export function EntityPropertiesToggle() {
  const state = useContext(PropertiesContext);
  if (!state || (!state.narrow && !state.toggleExpanded)) return null;
  if (!state.narrow) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        aria-label="Right sidebar"
        aria-controls={state.id}
        aria-expanded={state.expanded}
        onClick={state.toggleExpanded}
      >
        <PanelRight className="h-4 w-4" />
      </Button>
    );
  }
  return (
    <DialogPrimitive.Trigger asChild>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        aria-label="Right sidebar"
        aria-controls={state.id}
        onClick={(event) => state.setAnimate(event.detail > 0)}
      >
        <PanelRight className="h-4 w-4" />
      </Button>
    </DialogPrimitive.Trigger>
  );
}

/** Properties follow the record's available width, rather than the browser width. */
export function EntityPropertiesLayout({
  id,
  sidebar,
  children,
  resizable = false,
  collapsible = false,
  narrowAt = 1000,
  primaryMinSize = 480,
  secondaryMinSize = 280,
}: {
  id: string;
  sidebar: ReactNode;
  children: ReactNode;
  resizable?: boolean;
  collapsible?: boolean;
  narrowAt?: number;
  primaryMinSize?: number;
  secondaryMinSize?: number;
}) {
  const [sidebarHost, setSidebarHost] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const host = document.createElement("div");
    host.className = "h-full min-h-0";
    setSidebarHost(host);
  }, []);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [narrow, setNarrow] = useState(true);
  const [open, setOpen] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [expanded, setExpanded] = useState(true);
  useLayoutEffect(() => {
    if (!root) return;
    let previous: boolean | undefined;
    const update = (width: number) => {
      const next = width < narrowAt;
      setNarrow(next);
      if (next !== previous) setOpen(false);
      previous = next;
    };
    update(root.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) =>
      update(entry.contentRect.width),
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [root, narrowAt]);
  const properties = (
    <aside
      id={id}
      aria-label="Properties"
      className="h-full min-h-0 overflow-y-auto"
      ref={(node) => {
        if (node && sidebarHost && sidebarHost.parentNode !== node)
          node.appendChild(sidebarHost);
      }}
    />
  );
  return (
    <PropertiesContext.Provider value={{
      narrow, id, setAnimate, expanded,
      toggleExpanded: collapsible ? () => setExpanded((value) => !value) : undefined,
    }}>
      <DialogPrimitive.Root
        open={narrow && open}
        onOpenChange={setOpen}
        modal={false}
      >
        <div
          ref={setRoot}
          className="relative flex h-full min-h-0 min-w-0 flex-1 overflow-hidden"
          data-entity-properties-layout
        >
          {!narrow && resizable ? (
            <ResponsiveResizablePanels
              id={id}
              primary={children}
              secondary={properties}
              secondaryHidden={collapsible ? !expanded : undefined}
              onSecondaryHiddenChange={collapsible ? (hidden) => setExpanded(!hidden) : undefined}
              primaryMinSize={primaryMinSize}
              secondaryMinSize={secondaryMinSize}
              secondaryMaxSize={520}
              handleLabel="Resize details sidebar"
            />
          ) : (
            <>
              <div
                className="flex min-h-0 min-w-0 flex-1 flex-col"
              >
                {children}
              </div>
              {!narrow && (
                <div className="h-full w-96 shrink-0 border-l bg-background">
                  {properties}
                </div>
              )}
            </>
          )}
          {narrow && root && (
            <DialogPrimitive.Portal container={root}>
              <DialogPrimitive.Content
                aria-describedby={undefined}
                className={`absolute inset-y-0 right-0 z-40 flex w-[min(100%,24rem)] min-w-0 flex-col border-l bg-background pt-10 shadow-xl outline-none ${styles.drawer}`}
                data-motion={animate}
                onEscapeKeyDown={() => setAnimate(false)}
                onInteractOutside={(event) => event.preventDefault()}
              >
                <DialogPrimitive.Title className="sr-only">Right sidebar</DialogPrimitive.Title>
                <DialogPrimitive.Close asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 h-8 w-8"
                    aria-label="Close sidebar"
                    onClick={(event) => setAnimate(event.detail > 0)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </DialogPrimitive.Close>
                <div className="min-h-0 flex-1">{properties}</div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          )}
          {sidebarHost && createPortal(sidebar, sidebarHost)}
        </div>
      </DialogPrimitive.Root>
    </PropertiesContext.Provider>
  );
}
