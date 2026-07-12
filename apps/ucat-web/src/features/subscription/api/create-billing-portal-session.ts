export type BillingPortalAction =
  | "payment_method_update"
  | "subscription_cancel"
  | "subscription_update";

export async function createBillingPortalSession(
  action: BillingPortalAction,
): Promise<{ url: string }> {
  const res = await fetch("/api/ucat/billing-portal", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to open billing portal");
  }

  return (await res.json()) as { url: string };
}
