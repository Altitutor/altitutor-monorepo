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

type QuotaLimitContextValue = {
  payload: QuotaExceededPayload | null;
  open: boolean;
  openQuotaLimit: (payload: QuotaExceededPayload) => void;
  closeQuotaLimit: () => void;
};

const QuotaLimitContext = createContext<QuotaLimitContextValue | null>(null);

export function QuotaLimitProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<QuotaExceededPayload | null>(null);

  const openQuotaLimit = useCallback((next: QuotaExceededPayload) => {
    setPayload(next);
  }, []);

  const closeQuotaLimit = useCallback(() => {
    setPayload(null);
  }, []);

  const value = useMemo(
    () => ({
      payload,
      open: payload != null,
      openQuotaLimit,
      closeQuotaLimit,
    }),
    [payload, openQuotaLimit, closeQuotaLimit],
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
    throw new Error("useQuotaLimitModal must be used within QuotaLimitProvider");
  }
  return ctx;
}
