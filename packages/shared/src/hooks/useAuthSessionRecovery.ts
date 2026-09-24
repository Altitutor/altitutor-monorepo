"use client";

import { useEffect, useRef } from "react";

export type AuthSessionRecoveryOptions = {
  enabled?: boolean;
  isLoading: boolean;
  hasSession: boolean;
  recover?: () => void;
};

function reloadPage() {
  window.location.reload();
}

/**
 * Reconciles a client-side missing session with the server auth boundary.
 * Recovery is deliberately limited to one hard reload per mounted boundary so
 * a transient mismatch cannot become an App Router navigation loop.
 */
export function useAuthSessionRecovery({
  enabled = true,
  isLoading,
  hasSession,
  recover = reloadPage,
}: AuthSessionRecoveryOptions) {
  const recoveryStartedRef = useRef(false);

  useEffect(() => {
    if (
      !enabled ||
      isLoading ||
      hasSession ||
      recoveryStartedRef.current
    ) {
      return;
    }

    recoveryStartedRef.current = true;
    recover();
  }, [enabled, hasSession, isLoading, recover]);
}
