import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../api';

export function useBilling() {
  return useQuery({
    queryKey: ['student', 'billing'],
    queryFn: billingApi.getBilling,
  });
}

export function usePayments() {
  return useQuery({
    queryKey: ['student', 'payments'],
    queryFn: billingApi.getPayments,
  });
}

