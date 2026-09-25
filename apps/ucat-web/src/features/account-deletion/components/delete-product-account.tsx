"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Input,
  Label,
} from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { confirmedFullNameMatches } from "@/features/account-deletion/delete-ucat-product-account";

export function DeleteProductAccount({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"closed" | "consequences" | "confirm">(
    "closed",
  );
  const [typedName, setTypedName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameMatches = confirmedFullNameMatches(firstName, lastName, typedName);

  const close = () => {
    if (busy) return;
    setStep("closed");
    setTypedName("");
    setError(null);
  };

  const deleteAccount = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/ucat/account/deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: typedName }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        loginRemoved?: boolean;
      } | null;
      if (!response.ok) {
        setError(body?.error ?? "We couldn't delete your UCAT account.");
        return;
      }
      if (body?.loginRemoved) {
        await getSupabaseBrowserClient().auth.signOut();
        router.push("/login?deleted=1");
      } else {
        router.push("/signup/complete?deleted=1");
      }
      router.refresh();
    } catch {
      setError("We couldn't delete your UCAT account. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="delete-account" className="space-y-3">
      <div>
        <h2 className="text-base font-medium">Delete account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently delete your Altitutor UCAT account. Invoices and tutoring
          records are kept.
        </p>
      </div>
      <Button
        type="button"
        variant="destructive"
        onClick={() => setStep("consequences")}
      >
        Delete account
      </Button>

      <AlertDialog
        open={step === "consequences"}
        onOpenChange={(open) => !open && close()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete your Altitutor UCAT account?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This deletes your UCAT practice history, scores, and study plan.
              Later percentiles and answer statistics will no longer include
              your attempts. A paid plan is cancelled immediately and the
              current period is not refunded. Invoices and tutoring records stay
              for accounting. If Altitutor UCAT is your only relationship, you
              will need to sign up again to use it. The same email reopens UCAT
              without your old practice.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <AlertDialogCancel type="button" disabled={busy}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setStep("confirm")}
            >
              Continue
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={step === "confirm"}
        onOpenChange={(open) => !open && close()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Type your full name to confirm</AlertDialogTitle>
            <AlertDialogDescription>
              Enter {firstName} {lastName} to permanently delete your Altitutor
              UCAT account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="delete-account-full-name">Full name</Label>
            <Input
              id="delete-account-full-name"
              value={typedName}
              autoComplete="name"
              onChange={(event) => setTypedName(event.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setError(null);
                setStep("consequences");
              }}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !nameMatches}
              onClick={() => void deleteAccount()}
            >
              {busy ? "Deleting…" : "Delete account"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
