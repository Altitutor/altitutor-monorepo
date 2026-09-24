export type UcatCardSummary = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

export type UcatPaymentMethodResponse = {
  paymentMethod: UcatCardSummary | null;
};

async function readError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? fallback;
}

export async function fetchUcatPaymentMethod(): Promise<UcatPaymentMethodResponse> {
  const response = await fetch("/api/ucat/payment-method", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to load payment method"));
  }
  return (await response.json()) as UcatPaymentMethodResponse;
}

export async function createUcatPaymentMethodSetup(): Promise<{
  clientSecret: string;
}> {
  const response = await fetch("/api/ucat/payment-method", {
    method: "POST",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to prepare card update"));
  }
  return (await response.json()) as { clientSecret: string };
}

export async function applyUcatPaymentMethod(
  setupIntentId: string,
): Promise<UcatPaymentMethodResponse> {
  const response = await fetch("/api/ucat/payment-method", {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setupIntentId }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to update payment method"));
  }
  return (await response.json()) as UcatPaymentMethodResponse;
}
