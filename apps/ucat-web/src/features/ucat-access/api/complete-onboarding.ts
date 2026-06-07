export type OnboardingChoice = "free" | "pro_trial";

export async function completeUcatOnboarding(
  choice: OnboardingChoice,
): Promise<{ ok: boolean; alreadyCompleted?: boolean; choice?: OnboardingChoice }> {
  const res = await fetch("/api/ucat/onboarding/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ choice }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Failed to complete onboarding");
  }

  return res.json() as Promise<{
    ok: boolean;
    alreadyCompleted?: boolean;
    choice?: OnboardingChoice;
  }>;
}
