import { useQuery } from '@tanstack/react-query';
import type { Database } from '@altitutor/shared';
import { billingApi } from '../api';

type PaymentAttempt = Database['public']['Views']['vstudent_payment_attempts']['Row'];

export function useBilling() {
  return useQuery({
    queryKey: ['student', 'billing'],
    queryFn: billingApi.getBilling,
  });
}

export function usePayments() {
  return useQuery<PaymentAttempt[]>({
    queryKey: ['student', 'payments'],
    queryFn: billingApi.getPayments,
  });
}

