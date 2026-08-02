import { createContext, useContext } from "react";

import { useLagMode } from "@/features/question-engine/hooks/use-lag-mode";

type UcatLagContextValue = ReturnType<typeof useLagMode>;

const UcatLagContext = createContext<UcatLagContextValue | undefined>(
  undefined,
);

export function UcatLagProvider({
  children,
  enabled,
  onEnabledChange,
}: {
  children: React.ReactNode;
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
}) {
  const value = useLagMode({ enabled, onEnabledChange });

  return (
    <UcatLagContext.Provider value={value}>{children}</UcatLagContext.Provider>
  );
}

export function useUcatLag() {
  const ctx = useContext(UcatLagContext);
  if (!ctx) {
    throw new Error("useUcatLag must be used within a UcatLagProvider");
  }
  return ctx;
}
