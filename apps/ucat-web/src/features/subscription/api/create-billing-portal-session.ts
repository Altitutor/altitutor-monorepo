export async function createBillingPortalSession(): Promise<{ url: string }> {
  const res = await fetch("/api/ucat/billing-portal", {
    method: "POST",
    credentials: "same-origin",
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to open billing portal");
  }

  return (await res.json()) as { url: string };
}
