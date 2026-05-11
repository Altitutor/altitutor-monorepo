"use client";

import { createContext, useContext } from "react";

export type AppShellLayoutContextValue = {
  /** When true, main content is offset for the 240px sidebar (desktop only). */
  mainContentHasSidebarInset: boolean;
};

const AppShellLayoutContext = createContext<AppShellLayoutContextValue | null>(
  null,
);

export function AppShellLayoutProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AppShellLayoutContextValue;
}) {
  return (
    <AppShellLayoutContext.Provider value={value}>
      {children}
    </AppShellLayoutContext.Provider>
  );
}

export function useAppShellLayout(): AppShellLayoutContextValue {
  const ctx = useContext(AppShellLayoutContext);
  return ctx ?? { mainContentHasSidebarInset: false };
}
