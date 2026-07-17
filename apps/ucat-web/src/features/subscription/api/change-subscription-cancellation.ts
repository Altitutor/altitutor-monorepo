import type { StripeCancellationFeedback } from "@/features/subscription/lib/subscription-cancellation";

type CancellationResult = {
  cancelAt: string | null;
};

async function cancellationRequest(
  method: "POST" | "PUT" | "DELETE",
  body?: {
    feedback: StripeCancellationFeedback | null;
    comment: string | null;
  },
): Promise<CancellationResult> {
  const res = await fetch("/api/ucat/subscription/cancel", {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as
    | (CancellationResult & { error?: string })
    | null;
  if (!res.ok) {
    throw new Error(json?.error ?? "Failed to update your subscription");
  }
  return { cancelAt: json?.cancelAt ?? null };
}

export function scheduleUcatSubscriptionCancellation(input: {
  feedback: StripeCancellationFeedback | null;
  comment: string | null;
}): Promise<CancellationResult> {
  return cancellationRequest("POST", input);
}

export function resumeUcatSubscription(): Promise<CancellationResult> {
  return cancellationRequest("DELETE");
}

export function cancelUcatSubscriptionImmediately(): Promise<CancellationResult> {
  return cancellationRequest("PUT");
}
