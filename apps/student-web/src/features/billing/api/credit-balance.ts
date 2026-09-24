export interface CreditBalance {
  linked: boolean;
  balance_cents: number;
  currency: string;
  updated_at: string;
}

export async function fetchCreditBalance(): Promise<CreditBalance> {
  const response = await fetch("/api/billing/credit-balance", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load credit balance");
  }

  return response.json() as Promise<CreditBalance>;
}
