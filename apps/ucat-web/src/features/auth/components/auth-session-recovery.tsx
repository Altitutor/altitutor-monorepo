"use client";

import { useEffect, useRef } from "react";

type AuthSessionRecoveryProps = {
  isLoading: boolean;
  hasUser: boolean;
  recover?: () => void;
};

function reloadPage() {
  window.location.reload();
}

/**
 * Reconciles a client-side missing session with the server auth boundary.
 * A hard reload lets middleware make the authoritative routing decision and
 * avoids feeding a transient auth mismatch back into the App Router.
 */
export function AuthSessionRecovery({
  isLoading,
  hasUser,
  recover = reloadPage,
}: AuthSessionRecoveryProps) {
  const recoveryStartedRef = useRef(false);

  useEffect(() => {
    if (isLoading || hasUser || recoveryStartedRef.current) return;

    recoveryStartedRef.current = true;
    recover();
  }, [hasUser, isLoading, recover]);

  return null;
}
