"use client";

import { useEffect, useRef } from "react";
import { navigateAfterAuth } from "@/features/auth/lib/navigate-after-auth";

/**
 * Hard-nav away from /signup/complete once signup is already finished.
 *
 * Soft `redirect("/dashboard")` from the Server Component races middleware
 * when the access view briefly reports incomplete, causing a
 * /dashboard ↔ /signup/complete soft-nav loop that blank-screens the app.
 */
export function SignupCompleteHardRedirect({
  to = "/dashboard",
}: {
  to?: string;
}) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    navigateAfterAuth(to);
  }, [to]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 text-sm text-muted-foreground">
      Taking you to your dashboard…
    </div>
  );
}
