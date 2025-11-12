import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@altitutor/shared';
import { paymentMethodsApi } from '../api/payment-methods';
import { useAuthStore } from '@/shared/lib/supabase/auth';

const supabase = createClientComponentClient<Database>();

export function usePaymentMethods() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const studentId = user?.user_metadata?.student_id;

  const query = useQuery({
    queryKey: ['payment-methods'],
    queryFn: paymentMethodsApi.getPaymentMethods,
  });

  // Set up real-time subscription for payment method changes
  useEffect(() => {
    if (!studentId) return;

    const channel = supabase
      .channel(`payment-methods-${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_payment_methods',
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          console.log('[payment-methods] Real-time update received:', payload.eventType);
          // Invalidate and refetch payment methods when database changes
          queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
        }
      )
      .subscribe((status) => {
        console.log('[payment-methods] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId, queryClient]);

  return query;
}

export function useCreateSetupIntent() {
  return useMutation({
    mutationFn: (studentId: string) => paymentMethodsApi.createSetupIntent(studentId),
  });
}

export function useSetDefaultPaymentMethod() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (paymentMethodId: string) => paymentMethodsApi.setDefaultPaymentMethod(paymentMethodId),
    onSuccess: () => {
      // Optimistically update the cache
      queryClient.setQueryData(['payment-methods'], (old: any) => {
        if (!old || !old.payment_methods) return old;
        
        return {
          ...old,
          payment_methods: old.payment_methods.map((pm: any) => ({
            ...pm,
            is_default: pm.id === paymentMethodId,
          })),
          default_payment_method: old.payment_methods.find((pm: any) => pm.id === paymentMethodId) || null,
        };
      });
      
      // Then refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      
      toast({
        title: 'Success',
        description: 'Default payment method updated',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update default payment method',
        variant: 'destructive',
      });
    }
  });
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (paymentMethodId: string) => paymentMethodsApi.deletePaymentMethod(paymentMethodId),
    onSuccess: (_, paymentMethodId) => {
      // Optimistically remove from cache
      queryClient.setQueryData(['payment-methods'], (old: any) => {
        if (!old || !old.payment_methods) return old;
        
        const filteredMethods = old.payment_methods.filter((pm: any) => pm.id !== paymentMethodId);
        
        return {
          ...old,
          payment_methods: filteredMethods,
          default_payment_method: old.default_payment_method?.id === paymentMethodId 
            ? null 
            : old.default_payment_method,
        };
      });
      
      // Then refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      
      toast({
        title: 'Success',
        description: 'Payment method removed',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove payment method',
        variant: 'destructive',
      });
    }
  });
}








