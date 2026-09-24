import type { FutureInvoicePreview } from "../types/future-invoices";

export type { FutureInvoicePreview } from "../types/future-invoices";

export async function fetchFutureInvoices(): Promise<FutureInvoicePreview[]> {
  const response = await fetch("/api/billing/future-invoices", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load future invoices");
  }

  const data = (await response.json()) as {
    future_invoices: FutureInvoicePreview[];
  };
  return data.future_invoices;
}
