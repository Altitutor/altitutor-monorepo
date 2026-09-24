import { useQuery } from "@tanstack/react-query";
import { fetchFutureInvoices } from "../api/future-invoices";

export function useFutureInvoices() {
  return useQuery({
    queryKey: ["student", "billing", "future-invoices"],
    queryFn: fetchFutureInvoices,
    staleTime: 60_000,
  });
}
