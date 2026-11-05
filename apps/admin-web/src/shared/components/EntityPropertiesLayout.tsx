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
  useMediaQuery,
} from "@altitutor/ui";
import { PanelRight, X } from "lucide-react";
import styles from "./entity-properties-layout.module.css";

type PropertiesState = {
  narrow: boolean;
  id: string;
  setAnimate: (animate: boolean) => void;
};
const PropertiesContext = createContext<PropertiesState | null>(null);

/** The same control is placed in each record's own header, including accessory records. */
export function EntityPropertiesToggle() {
  const state = useContext(PropertiesContext);
  if (!state?.narrow) return null;
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
  primaryMinSize = 480,
  secondaryMinSize = 280,
}: {
  id: string;
  sidebar: ReactNode;
  children: ReactNode;
  resizable?: boolean;
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
  const mobile = useMediaQuery("(max-width: 767px)");
  useLayoutEffect(() => {
    if (!root) return;
    let previous: boolean | undefined;
    const update = (width: number) => {
      const next = width < 1000;
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
  }, [root]);
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
    <PropertiesContext.Provider value={{ narrow, id, setAnimate }}>
      <DialogPrimitive.Root
        open={narrow && open}
        onOpenChange={setOpen}
        modal={mobile}
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
              primaryMinSize={primaryMinSize}
              secondaryMinSize={secondaryMinSize}
              secondaryMaxSize={520}
              handleLabel="Resize details sidebar"
            />
          ) : (
            <>
              <div
                className="flex min-h-0 min-w-0 flex-1 flex-col"
                inert={narrow && open ? true : undefined}
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
              {open && (
                <div
                  className="pointer-events-auto absolute inset-0 z-30 bg-black/20"
                  onClick={() => setOpen(false)}
                />
              )}
              <DialogPrimitive.Content
                aria-describedby={undefined}
                className={`absolute inset-y-0 right-0 z-40 flex w-[min(100%,24rem)] min-w-0 flex-col border-l bg-background shadow-xl outline-none ${styles.drawer}`}
                data-motion={animate}
                onEscapeKeyDown={() => setAnimate(false)}
                onInteractOutside={(event) => event.preventDefault()}
              >
                <div className="flex shrink-0 items-center justify-between border-b p-3">
                  <DialogPrimitive.Title className="text-sm font-medium">
                    Right sidebar
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Close asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Close sidebar"
                      onClick={(event) => setAnimate(event.detail > 0)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </DialogPrimitive.Close>
                </div>
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
