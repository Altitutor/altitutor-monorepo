"use client";

import React, { useState } from "react";
import type { ActiveStaffRole } from "@/features/auth/server/active-staff";
import { navigateAfterAuth } from "@/features/auth/lib/navigate-after-auth";

const PORTAL_BY_ROLE: Record<
  ActiveStaffRole,
  { href: string; label: string; noun: string }
> = {
  ADMINSTAFF: {
    href: "https://admin.altitutor.com",
    label: "Admin Portal",
    noun: "staff",
  },
  TUTOR: {
    href: "https://tutor.altitutor.com",
    label: "Tutor Portal",
    noun: "tutor",
  },
};

export function StaffAccountNotice({ role }: { role: ActiveStaffRole }) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const portal = PORTAL_BY_ROLE[role];

  async function handleUseAnotherAccount() {
    setIsSigningOut(true);
    const response = await fetch("/api/auth/signout", { method: "POST" }).catch(
      () => null,
    );
    if (!response?.ok) {
      setIsSigningOut(false);
      return;
    }
    navigateAfterAuth("/signup");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <section className="w-full max-w-md space-y-6 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Use your Student account</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This account belongs to an Altitutor {portal.noun} and cannot be
            used for Altitutor UCAT Student signup.
          </p>
        </div>

        <div className="space-y-3">
          <a
            href={portal.href}
            className="flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground"
          >
            {portal.label}
          </a>
          <button
            type="button"
            onClick={() => void handleUseAnotherAccount()}
            disabled={isSigningOut}
            className="min-h-12 w-full rounded-full border border-border bg-background px-5 py-3 font-semibold text-foreground disabled:opacity-50"
          >
            {isSigningOut ? "Signing out…" : "Use another account"}
          </button>
        </div>
      </section>
    </main>
  );
}
