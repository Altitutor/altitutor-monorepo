/**
 * Creates a Stripe Checkout Session for UCAT subscription.
 * Pass an optional `priceId` to override the default configured price.
 * Returns the redirect URL to Stripe hosted checkout.
 */
export async function createUcatCheckoutSession(
  priceId?: string,
): Promise<{ url: string }> {
  const res = await fetch("/api/ucat/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(priceId ? { priceId } : {}),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = (body as { error?: string })?.error ?? res.statusText;
    throw new Error(message);
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) {
    throw new Error("No checkout URL returned");
  }

  return { url: data.url };
}
