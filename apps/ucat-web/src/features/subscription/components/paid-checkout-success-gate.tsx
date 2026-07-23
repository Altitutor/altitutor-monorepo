"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useReducedMotion } from "motion/react";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import {
  SignupSuccessTransition,
  type SignupSuccessTransitionPhase,
} from "@/features/signup-onboarding/components/signup-success-transition";

type PaidCheckoutSuccessGateProps = {
  active: boolean;
  returnPath: string;
  children: ReactNode;
};

function isPaidOnlineTier(tier: string | null) {
  return tier === "unlimited" || tier === "unlimited_trial";
}

export function PaidCheckoutSuccessGate({
  active,
  returnPath,
  children,
}: PaidCheckoutSuccessGateProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const access = useUcatAccess();
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<SignupSuccessTransitionPhase | null>(() =>
    active ? "confirming" : null,
  );
  const [isTakingLonger, setIsTakingLonger] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const transitionStartedAt = useRef(active ? Date.now() : 0);
  const confirmationStarted = useRef(false);

  useEffect(() => {
    if (!active || phase !== "confirming") return;

    if (transitionStartedAt.current === 0) {
      transitionStartedAt.current = Date.now();
    }

    let attempts = 0;
    const refreshAccess = () =>
      queryClient.refetchQueries({
        queryKey: ["ucat-access"],
        type: "active",
      });

    void refreshAccess();
    const timer = window.setInterval(() => {
      attempts += 1;
      void refreshAccess();
      if (attempts >= 12) setIsTakingLonger(true);
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [active, phase, queryClient]);

  useEffect(() => {
    if (phase !== "confirming") return;
    if (!access.accessLoadFailed) {
      setAccessError(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setAccessError(
        "Your payment succeeded, but we couldn’t refresh your plan. Please try again.",
      );
    }, 2_000);

    return () => window.clearTimeout(timer);
  }, [access.accessLoadFailed, phase]);

  useEffect(() => {
    if (
      phase !== "confirming" ||
      access.isLoading ||
      !isPaidOnlineTier(access.onlineTier) ||
      confirmationStarted.current
    ) {
      return;
    }

    confirmationStarted.current = true;
    const minimumAnimationMs = reduceMotion ? 350 : 2_800;
    const elapsed = Date.now() - transitionStartedAt.current;
    const timer = window.setTimeout(
      () => setPhase("welcome"),
      Math.max(0, minimumAnimationMs - elapsed),
    );

    return () => window.clearTimeout(timer);
  }, [access.isLoading, access.onlineTier, phase, reduceMotion]);

  const finishTransition = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ucat-access"] }),
      queryClient.invalidateQueries({ queryKey: ["ucat-quota-usage"] }),
      queryClient.invalidateQueries({
        queryKey: ["ucat-practice-discount-dashboard"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["ucat", "subscription-billing"],
      }),
    ]);
    await queryClient.refetchQueries({
      queryKey: ["ucat-access"],
      type: "active",
    });

    router.replace(returnPath, { scroll: false });
    router.refresh();
    setPhase(null);
  }, [queryClient, returnPath, router]);
  const handleTransitionComplete = useCallback(() => {
    void finishTransition();
  }, [finishTransition]);

  if (!active || !phase) return children;

  return (
    <div className="fixed inset-0 z-[100] overflow-auto bg-marketing-charcoal">
      <SignupSuccessTransition
        journey="paid"
        occasion="upgrade"
        phase={phase}
        isTakingLonger={isTakingLonger}
        error={accessError}
        onRetry={() => {
          setIsTakingLonger(false);
          setAccessError(null);
          void queryClient.refetchQueries({
            queryKey: ["ucat-access"],
            type: "active",
          });
        }}
        onComplete={handleTransitionComplete}
      />
    </div>
  );
}
