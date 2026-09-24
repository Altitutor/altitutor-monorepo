import { useQuery } from "@tanstack/react-query";
import { fetchUcatPaymentMethod } from "@/features/subscription/api/ucat-payment-method";

export const UCAT_PAYMENT_METHOD_QUERY_KEY = [
  "ucat",
  "payment-method",
] as const;

export function useUcatPaymentMethod() {
  return useQuery({
    queryKey: UCAT_PAYMENT_METHOD_QUERY_KEY,
    queryFn: fetchUcatPaymentMethod,
    staleTime: 60_000,
  });
}
