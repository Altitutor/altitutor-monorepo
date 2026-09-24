import { useQuery } from '@tanstack/react-query';
import { subjectPricingOverridesApi } from '../api/subject-pricing-overrides';

export const subjectPricingOverridesKeys = {
  all: ['subject-pricing-overrides'] as const,
};

export function useSubjectPricingOverrides(enabled = true) {
  return useQuery({
    queryKey: subjectPricingOverridesKeys.all,
    queryFn: () => subjectPricingOverridesApi.getAllSubjectOverrides(),
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}
