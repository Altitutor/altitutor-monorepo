import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { paymentMethodsApi } from '../api/payment-methods';
import { useAuthStore } from '@/shared/lib/supabase/auth';

export function usePaymentMethods() {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuthStore();

  const query = useQuery({
    queryKey: ['payment-methods'],
    queryFn: paymentMethodsApi.getPaymentMethods,
    // Wait for auth to be ready before querying
    enabled: !authLoading && !!user,
    // Don't refetch on window focus to prevent overwriting optimistic updates
    refetchOnWindowFocus: false,
    // Don't refetch on reconnect immediately
    refetchOnReconnect: false,
  });

  // Get student ID from the billing query result
  const studentId = query.data?.student_id;

  // Set up real-time subscription for payment method changes
  useEffect(() => {
    if (!studentId) return;

    const supabase = getSupabaseClient();
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
          console.log('[payment-methods] Real-time update received:', payload.eventType, payload);
          
          // When a new payment method is inserted, replace the optimistic placeholder
          // by matching the stripe_payment_method_id
          if (payload.eventType === 'INSERT') {
            queryClient.setQueryData(['payment-methods'], (old: any) => {
              if (!old || !old.payment_methods) return old;
              
              const newPaymentMethod = payload.new;
              const stripePmId = newPaymentMethod.stripe_payment_method_id;
              
              // Replace the optimistic placeholder with the real payment method
              const updatedMethods = old.payment_methods.map((pm: any) => {
                if (pm.stripe_payment_method_id === stripePmId && pm.id?.startsWith('temp-')) {
                  return {
                    ...newPaymentMethod,
                    // Keep the same structure
                  };
                }
                return pm;
              });
              
              // If no match found, add the new payment method
              const hasMatch = old.payment_methods.some((pm: any) => 
                pm.stripe_payment_method_id === stripePmId && pm.id?.startsWith('temp-')
              );
              
              if (!hasMatch) {
                updatedMethods.push(newPaymentMethod);
              }
              
              return {
                ...old,
                payment_methods: updatedMethods,
              };
            });
          } else {
            // For updates/deletes, just invalidate and refetch
            queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
          }
        }
      )
      .subscribe((status) => {
        console.log('[payment-methods] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[payment-methods] Successfully subscribed to real-time updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[payment-methods] Real-time subscription error - falling back to polling');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId, queryClient]);

  // Fallback: Poll for updates after optimistic updates
  // This ensures we get updates even if real-time isn't working or is delayed
  useEffect(() => {
    if (!studentId) return;

    // Check if there are any optimistic (temp) payment methods
    const data = queryClient.getQueryData(['payment-methods']) as any;
    const hasOptimisticUpdates = data?.payment_methods?.some((pm: any) => pm.id?.startsWith('temp-'));
    
    if (!hasOptimisticUpdates) return;

    // Poll every 2 seconds for up to 10 seconds to catch webhook updates
    let pollCount = 0;
    const maxPolls = 5; // 5 polls * 2 seconds = 10 seconds max
    
    const pollInterval = setInterval(() => {
      pollCount++;
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      
      if (pollCount >= maxPolls) {
        clearInterval(pollInterval);
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
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
    onSuccess: (_, paymentMethodId) => {
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








