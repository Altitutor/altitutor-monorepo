import type { SignupOnboardingStep } from "@/features/signup-onboarding/types";
import { isSignupOnboardingStep } from "@/features/signup-onboarding/lib/steps";

export type SignupProgressResponse = {
  step: SignupOnboardingStep;
  signupCompleted: boolean;
  planChoiceCompleted: boolean;
  testYear: number | null;
};

export async function fetchSignupProgress(): Promise<SignupProgressResponse> {
  const res = await fetch("/api/ucat/signup/progress");
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Failed to load signup progress");
  }
  return (await res.json()) as SignupProgressResponse;
}

export async function patchSignupProgress(input: {
  step?: SignupOnboardingStep;
  complete?: boolean;
  planComplete?: boolean;
  testYear?: number | null;
}): Promise<SignupProgressResponse> {
  const res = await fetch("/api/ucat/signup/progress", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Failed to update signup progress");
  }
  return (await res.json()) as SignupProgressResponse;
}

export function parseSignupProgressResponse(
  value: unknown,
): SignupProgressResponse | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!isSignupOnboardingStep(v.step)) return null;
  return {
    step: v.step,
    signupCompleted: Boolean(v.signupCompleted),
    planChoiceCompleted: Boolean(v.planChoiceCompleted),
    testYear: typeof v.testYear === "number" ? v.testYear : null,
  };
}
