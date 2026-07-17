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
import type { QuotaExceededPayload } from "@/features/ucat-access/types/quota";

export type QuotaLimitDismissAction = {
  label?: string;
  href?: string;
  onDismiss?: () => void;
  variant?: "dashboard" | "dismiss";
};

export type PlanPickerDialogContext =
  | {
      kind: "browse";
      title?: string;
      description?: string;
    }
  | {
      kind: "quota_limit";
      payload: QuotaExceededPayload;
      dismissAction?: QuotaLimitDismissAction;
    };

type UpsellDialogContextValue = {
  planPickerOpen: boolean;
  planPickerContext: PlanPickerDialogContext | null;
  inPersonUpsellOpen: boolean;
  openPlanPicker: (
    context?: Omit<
      Extract<PlanPickerDialogContext, { kind: "browse" }>,
      "kind"
    >,
  ) => void;
  openQuotaLimit: (
    payload: QuotaExceededPayload,
    options?: { dismissAction?: QuotaLimitDismissAction },
  ) => void;
  closePlanPicker: () => void;
  closeQuotaLimit: () => void;
  openInPersonUpsell: () => void;
  closeInPersonUpsell: () => void;
};

const UpsellDialogContext = createContext<UpsellDialogContextValue | null>(
  null,
);

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

  const openPlanPicker = useCallback(
    (context?: { title?: string; description?: string }) => {
      setPlanPickerContext({ kind: "browse", ...context });
      setPlanPickerOpen(true);
      if (window.location.hash !== "#pricing") {
        window.history.pushState(null, "", "#pricing");
      }
    },
    [],
  );

  const openQuotaLimit = useCallback(
    (
      payload: QuotaExceededPayload,
      options?: { dismissAction?: QuotaLimitDismissAction },
    ) => {
      setPlanPickerContext({
        kind: "quota_limit",
        payload,
        dismissAction: options?.dismissAction,
      });
      setPlanPickerOpen(true);
      if (window.location.hash !== "#pricing") {
        window.history.pushState(null, "", "#pricing");
      }
    },
    [],
  );

  const closePlanPicker = useCallback(() => {
    setPlanPickerOpen(false);
    setPlanPickerContext(null);
    if (window.location.hash === "#pricing") {
      window.history.back();
    }
  }, []);

  const closeQuotaLimit = useCallback(() => {
    setPlanPickerOpen(false);
    setPlanPickerContext(null);
    if (window.location.hash === "#pricing") {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
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
      openQuotaLimit,
      closePlanPicker,
      closeQuotaLimit,
      openInPersonUpsell,
      closeInPersonUpsell,
    }),
    [
      planPickerOpen,
      planPickerContext,
      inPersonUpsellOpen,
      openPlanPicker,
      openQuotaLimit,
      closePlanPicker,
      closeQuotaLimit,
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

export function useQuotaLimitDialog() {
  const ctx = useUpsellDialog();
  const quotaContext =
    ctx.planPickerContext?.kind === "quota_limit"
      ? ctx.planPickerContext
      : null;

  return {
    payload: quotaContext?.payload ?? null,
    dismissAction: quotaContext?.dismissAction ?? null,
    open: ctx.planPickerOpen && quotaContext != null,
    openQuotaLimit: ctx.openQuotaLimit,
    closeQuotaLimit: ctx.closeQuotaLimit,
  };
}
