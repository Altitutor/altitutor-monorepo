"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { QuotaExceededPayload } from "@/features/ucat-access/types/quota";

export type QuotaLimitDismissAction = {
  label?: string;
  onDismiss?: () => void;
  variant?: "dashboard" | "dismiss";
};

type QuotaLimitOpenOptions = {
  dismissAction?: QuotaLimitDismissAction;
};

type QuotaLimitContextValue = {
  payload: QuotaExceededPayload | null;
  dismissAction: QuotaLimitDismissAction | null;
  open: boolean;
  openQuotaLimit: (
    payload: QuotaExceededPayload,
    options?: QuotaLimitOpenOptions,
  ) => void;
  closeQuotaLimit: () => void;
};

const QuotaLimitContext = createContext<QuotaLimitContextValue | null>(null);

export function QuotaLimitProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<QuotaExceededPayload | null>(null);
  const [dismissAction, setDismissAction] =
    useState<QuotaLimitDismissAction | null>(null);

  const openQuotaLimit = useCallback(
    (next: QuotaExceededPayload, options?: QuotaLimitOpenOptions) => {
      setPayload(next);
      setDismissAction(options?.dismissAction ?? null);
    },
    [],
  );

  const closeQuotaLimit = useCallback(() => {
    setPayload(null);
    setDismissAction(null);
  }, []);

  const value = useMemo(
    () => ({
      payload,
      dismissAction,
      open: payload != null,
      openQuotaLimit,
      closeQuotaLimit,
    }),
    [payload, dismissAction, openQuotaLimit, closeQuotaLimit],
  );

  return (
    <QuotaLimitContext.Provider value={value}>
      {children}
    </QuotaLimitContext.Provider>
  );
}

export function useQuotaLimitModal(): QuotaLimitContextValue {
  const ctx = useContext(QuotaLimitContext);
  if (!ctx) {
    throw new Error(
      "useQuotaLimitModal must be used within QuotaLimitProvider",
    );
  }
  return ctx;
}
