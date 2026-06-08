"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PlanPickerDialogContext = {
  title?: string;
  description?: string;
};

type UpsellDialogContextValue = {
  planPickerOpen: boolean;
  planPickerContext: PlanPickerDialogContext | null;
  inPersonUpsellOpen: boolean;
  openPlanPicker: (context?: PlanPickerDialogContext) => void;
  closePlanPicker: () => void;
  openInPersonUpsell: () => void;
  closeInPersonUpsell: () => void;
};

const UpsellDialogContext = createContext<UpsellDialogContextValue | null>(null);

export function UpsellDialogProvider({ children }: { children: ReactNode }) {
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [planPickerContext, setPlanPickerContext] =
    useState<PlanPickerDialogContext | null>(null);
  const [inPersonUpsellOpen, setInPersonUpsellOpen] = useState(false);

  const openPlanPicker = useCallback((context?: PlanPickerDialogContext) => {
    setPlanPickerContext(context ?? null);
    setPlanPickerOpen(true);
  }, []);

  const closePlanPicker = useCallback(() => {
    setPlanPickerOpen(false);
    setPlanPickerContext(null);
  }, []);

  const openInPersonUpsell = useCallback(() => {
    setInPersonUpsellOpen(true);
  }, []);

  const closeInPersonUpsell = useCallback(() => {
    setInPersonUpsellOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      planPickerOpen,
      planPickerContext,
      inPersonUpsellOpen,
      openPlanPicker,
      closePlanPicker,
      openInPersonUpsell,
      closeInPersonUpsell,
    }),
    [
      planPickerOpen,
      planPickerContext,
      inPersonUpsellOpen,
      openPlanPicker,
      closePlanPicker,
      openInPersonUpsell,
      closeInPersonUpsell,
    ],
  );

  return (
    <UpsellDialogContext.Provider value={value}>
      {children}
    </UpsellDialogContext.Provider>
  );
}

export function useUpsellDialog(): UpsellDialogContextValue {
  const ctx = useContext(UpsellDialogContext);
  if (!ctx) {
    throw new Error("useUpsellDialog must be used within UpsellDialogProvider");
  }
  return ctx;
}
