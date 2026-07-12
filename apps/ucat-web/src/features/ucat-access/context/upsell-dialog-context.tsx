"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

  useEffect(() => {
    const syncUpsellHash = () => {
      const hash = window.location.hash;
      const pricingOpen = hash === "#pricing";
      setPlanPickerOpen(pricingOpen);
      setInPersonUpsellOpen(hash === "#in-person");
      if (!pricingOpen) setPlanPickerContext(null);
    };

    syncUpsellHash();
    window.addEventListener("hashchange", syncUpsellHash);
    window.addEventListener("popstate", syncUpsellHash);
    return () => {
      window.removeEventListener("hashchange", syncUpsellHash);
      window.removeEventListener("popstate", syncUpsellHash);
    };
  }, []);

  const openPlanPicker = useCallback((context?: PlanPickerDialogContext) => {
    setPlanPickerContext(context ?? null);
    setPlanPickerOpen(true);
    if (window.location.hash !== "#pricing") {
      window.history.pushState(null, "", "#pricing");
    }
  }, []);

  const closePlanPicker = useCallback(() => {
    setPlanPickerOpen(false);
    setPlanPickerContext(null);
    if (window.location.hash === "#pricing") {
      window.history.back();
    }
  }, []);

  const openInPersonUpsell = useCallback(() => {
    setInPersonUpsellOpen(true);
    if (window.location.hash !== "#in-person") {
      window.history.pushState(null, "", "#in-person");
    }
  }, []);

  const closeInPersonUpsell = useCallback(() => {
    setInPersonUpsellOpen(false);
    if (window.location.hash === "#in-person") {
      window.history.back();
    }
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
