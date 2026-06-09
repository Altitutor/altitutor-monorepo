"use client";

import { createContext, useContext, useMemo, useState } from "react";

type SidebarOverrideContextValue = {
  /** When set, overrides the shell sidebar collapsed state. */
  collapsedOverride: boolean | null;
  setCollapsedOverride: (value: boolean | null) => void;
  /** Hide floating top bar (menu, theme, profile) during immersive play. */
  hideTopBar: boolean;
  setHideTopBar: (value: boolean) => void;
};

const SidebarOverrideContext = createContext<SidebarOverrideContextValue | null>(null);

export function SidebarOverrideProvider({ children }: { children: React.ReactNode }) {
  const [collapsedOverride, setCollapsedOverride] = useState<boolean | null>(null);
  const [hideTopBar, setHideTopBar] = useState(false);
  const value = useMemo(
    () => ({ collapsedOverride, setCollapsedOverride, hideTopBar, setHideTopBar }),
    [collapsedOverride, hideTopBar],
  );
  return (
    <SidebarOverrideContext.Provider value={value}>
      {children}
    </SidebarOverrideContext.Provider>
  );
}

export function useSidebarOverride(): SidebarOverrideContextValue | null {
  return useContext(SidebarOverrideContext);
}
