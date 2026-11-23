"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { accessoryHref } from "@/shared/contexts/AccessoryPanelContext";
import { AccessoryTabContext, type AccessoryTabScope } from "@/shared/contexts/AccessoryTabContext";
import { accessoryDestination } from "@/shared/hooks/usePaneNavigation";
import { paneCloseEvent } from "@/shared/components/pane-workspace/pane-routing";
import { AccessoryView } from "./AccessoryViews";

export function AccessoryRoute({ href }: { href: string }) {
  const router = useRouter();
  const search = useSearchParams().toString();
  const gate = useRef<((next?: () => void) => void) | null>(null);
  const registerClose = useCallback((next: typeof gate.current) => { gate.current = next; }, []);
  const destination = useMemo(() => accessoryDestination(`${href}?${search}`), [href, search]);
  const scope = useMemo<AccessoryTabScope | null>(() => !destination ? null : ({
    tab: { ...destination, key: "route", query: search },
    active: true,
    close: () => router.back(),
    navigate: (target) => router.push(accessoryHref(target)),
    registerClose,
  }), [destination, router, search, registerClose]);

  useEffect(() => {
    const close = (event: Event) => {
      if (!gate.current) return;
      event.preventDefault();
      gate.current((event as CustomEvent<() => void>).detail);
    };
    window.addEventListener(paneCloseEvent, close);
    return () => window.removeEventListener(paneCloseEvent, close);
  }, []);

  if (!scope) return null;
  return (
    <AccessoryTabContext.Provider value={scope}>
      <AccessoryView />
    </AccessoryTabContext.Provider>
  );
}
