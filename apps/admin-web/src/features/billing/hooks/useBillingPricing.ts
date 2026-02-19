import { useQuery } from '@tanstack/react-query';
import { pricingApi } from '../api/pricing';

export const billingPricingKeys = {
  all: ['billing-pricing'] as const,
};

/**
 * React Query hook for billing pricing (default rates per billing type).
 * Replaces useEffect-based fetching in StudentSubsidiesTable and similar components.
 */
export function useBillingPricing(enabled = true) {
  return useQuery({
    queryKey: billingPricingKeys.all,
    queryFn: () => pricingApi.getBillingPricing(),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes - pricing changes infrequently
  });
}
