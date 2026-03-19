/**
 * Creates a Stripe Checkout Session for UCAT subscription.
 * Returns the redirect URL to Stripe hosted checkout.
 */
export async function createUcatCheckoutSession(): Promise<{ url: string }> {
  const res = await fetch('/api/ucat/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message = (body as { error?: string })?.error ?? res.statusText
    throw new Error(message)
  }

  const data = (await res.json()) as { url?: string }
  if (!data.url) {
    throw new Error('No checkout URL returned')
  }

  return { url: data.url }
}
