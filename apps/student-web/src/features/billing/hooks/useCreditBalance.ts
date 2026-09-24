import { useQuery } from "@tanstack/react-query";
import { fetchCreditBalance } from "../api/credit-balance";

export function useCreditBalance() {
  return useQuery({
    queryKey: ["student", "billing", "credit-balance"],
    queryFn: fetchCreditBalance,
    staleTime: 60_000,
  });
}
