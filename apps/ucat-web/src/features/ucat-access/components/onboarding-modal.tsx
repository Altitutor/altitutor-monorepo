"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@altitutor/ui";
import { completeUcatOnboarding } from "@/features/ucat-access/api/complete-onboarding";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { createUcatCheckoutSession } from "@/features/subscription/api/create-checkout";

export function OnboardingModal() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const access = useUcatAccess();
  const [submitting, setSubmitting] = useState<"free" | "pro_trial" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const open =
    !access.isLoading &&
    access.hasOnlineAccess &&
    !access.onboardingCompleted;

  const invalidateAccess = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ucat-access"] }),
      queryClient.invalidateQueries({ queryKey: ["ucat-quota-usage"] }),
    ]);
  };

  const handleFree = async () => {
    setSubmitting("free");
    setError(null);
    try {
      await completeUcatOnboarding("free");
      await invalidateAccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(null);
    }
  };

  const handleProTrial = async () => {
    setSubmitting("pro_trial");
    setError(null);
    try {
      await completeUcatOnboarding("pro_trial");
      await invalidateAccess();
      const { url } = await createUcatCheckoutSession();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(null);
      router.push("/subscribe");
    }
  };

  if (!open) return null;

  const trialDisabled = !access.proTrialEligible;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Choose how you&apos;d like to start</AlertDialogTitle>
          <AlertDialogDescription>
            UCAT Free includes limited access to Learn, Practice, Sets, Mocks,
            and Skill trainer. UCAT Pro unlocks everything with no limits.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {!trialDisabled ? (
            <AlertDialogAction
              disabled={submitting !== null}
              onClick={() => void handleProTrial()}
              className="w-full"
            >
              {submitting === "pro_trial"
                ? "Starting trial…"
                : "Try Pro free for 7 days"}
            </AlertDialogAction>
          ) : null}
          <AlertDialogAction
            disabled={submitting !== null}
            onClick={() => void handleFree()}
            className="w-full"
          >
            {submitting === "free" ? "Saving…" : "Continue with Free"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
