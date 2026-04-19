"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ComingSoonModal } from "@/features/layout/components/coming-soon-modal";

type ComingSoonContextValue = {
  showComingSoonModal: () => void;
};

const ComingSoonContext = createContext<ComingSoonContextValue | null>(null);

export function useComingSoon(): ComingSoonContextValue {
  const ctx = useContext(ComingSoonContext);
  if (!ctx) {
    throw new Error("useComingSoon must be used within ComingSoonProvider");
  }
  return ctx;
}

type ComingSoonProviderProps = {
  children: ReactNode;
  /** When true, modal is shown (e.g. when user landed on a coming-soon route). */
  openOnMount?: boolean;
  /** Called when user confirms the modal and we're on a coming-soon route (e.g. redirect to dashboard). */
  onConfirmRedirect?: () => void;
};

export function ComingSoonProvider({
  children,
  openOnMount = false,
  onConfirmRedirect,
}: ComingSoonProviderProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (openOnMount) setOpen(true);
  }, [openOnMount]);

  const showComingSoonModal = useCallback(() => {
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next && openOnMount && onConfirmRedirect) {
        onConfirmRedirect();
      }
    },
    [openOnMount, onConfirmRedirect],
  );

  return (
    <ComingSoonContext.Provider value={{ showComingSoonModal }}>
      {children}
      <ComingSoonModal open={open} onOpenChange={handleOpenChange} />
    </ComingSoonContext.Provider>
  );
}
