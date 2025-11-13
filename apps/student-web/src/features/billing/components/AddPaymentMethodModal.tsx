'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Button, Label } from '@altitutor/ui';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2, CreditCard } from 'lucide-react';
import { useCreateSetupIntent, usePaymentMethods } from '../hooks/usePaymentMethods';
import { useToast } from '@altitutor/ui';
import { useQueryClient } from '@tanstack/react-query';

// Use pre-loaded Stripe instance from usePreWarmBilling
// This ensures Stripe.js is already loaded when modal opens
let stripePromise: Promise<any> | null = null;
function getStripePromise() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');
  }
  return stripePromise;
}

interface AddPaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
}

function PaymentForm({ onSuccess, onCancel, clientSecret, studentId }: { 
  onSuccess: () => void; 
  onCancel: () => void;
  clientSecret: string;
  studentId: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Detect dark mode dynamically
  const isDarkMode = typeof window !== 'undefined' && 
    document.documentElement.classList.contains('dark');

  const elementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: isDarkMode ? '#ffffff' : '#1a1a1a', // White in dark mode, dark in light mode
        fontFamily: 'system-ui, sans-serif',
        '::placeholder': {
          color: isDarkMode ? '#9ca3af' : '#6b7280',
        },
      },
      invalid: {
        color: '#ef4444',
      },
    },
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    const cardNumberElement = elements.getElement(CardNumberElement);

    if (!cardNumberElement) {
      setError('Card element not found');
      setIsProcessing(false);
      return;
    }

    try {
      const { setupIntent, error: confirmError } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardNumberElement,
        },
      });

      if (confirmError) {
        setError(confirmError.message || 'Failed to add payment method');
        setIsProcessing(false);
        return;
      }

      if (setupIntent && setupIntent.status === 'succeeded') {
        const paymentMethodId = setupIntent.payment_method as string;
        
        // Optimistically update the UI with a placeholder payment method
        // The webhook will save it to the database, and the real-time subscription
        // will update it with the actual card details (brand, last4, expiry, etc.)
        const optimisticPaymentMethod = {
          id: `temp-${paymentMethodId}`, // Use payment method ID so we can match/replace it later
          stripe_payment_method_id: paymentMethodId,
          is_default: false, // Will be set by webhook if it's the first one
          card_brand: 'card', // Placeholder - will be replaced by real-time subscription
          card_last4: '••••', // Placeholder - will be replaced by real-time subscription
          card_exp_month: 0, // Placeholder - will be replaced by real-time subscription
          card_exp_year: 0, // Placeholder - will be replaced by real-time subscription
          card_country: null,
          created_at: new Date().toISOString(),
        };

        // Optimistically add to cache - ensure we handle null payment_methods
        queryClient.setQueryData(['payment-methods'], (old: any) => {
          console.log('[AddPaymentMethod] Optimistic update - old data:', old);
          
          if (!old) {
            // If no data exists, create a minimal structure
            const newData = {
              student_id: studentId,
              stripe_customer_id: '',
              payment_methods: [optimisticPaymentMethod],
              default_payment_method: null,
            };
            console.log('[AddPaymentMethod] Created new data structure:', newData);
            return newData;
          }
          
          // Handle payment_methods - could be array or JSON string
          let existingMethods: any[] = [];
          if (old.payment_methods) {
            if (Array.isArray(old.payment_methods)) {
              existingMethods = old.payment_methods;
            } else if (typeof old.payment_methods === 'string') {
              try {
                existingMethods = JSON.parse(old.payment_methods);
              } catch {
                existingMethods = [];
              }
            }
          }
          
          const updatedData = {
            ...old,
            payment_methods: [...existingMethods, optimisticPaymentMethod],
          };
          console.log('[AddPaymentMethod] Updated data:', updatedData);
          return updatedData;
        });

        toast({
          title: 'Success',
          description: 'Payment method added successfully',
        });
        
        // Close modal immediately - optimistic update is already in cache
        // Real-time subscription will update with actual data when webhook processes
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cardNumber">Card Number</Label>
        <div className="border rounded-md p-3 bg-white dark:bg-gray-800">
          <CardNumberElement 
            id="cardNumber"
            options={elementOptions}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cardExpiry">Expiry Date</Label>
          <div className="border rounded-md p-3 bg-white dark:bg-gray-800">
            <CardExpiryElement 
              id="cardExpiry"
              options={elementOptions}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cardCvc">CVC</Label>
          <div className="border rounded-md p-3 bg-white dark:bg-gray-800">
            <CardCvcElement 
              id="cardCvc"
              options={elementOptions}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive">
          {error}
        </div>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isProcessing || !stripe || !elements}
        >
          {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isProcessing ? 'Adding...' : 'Add Payment Method'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddPaymentMethodModal({ isOpen, onClose, studentId }: AddPaymentMethodModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const createSetupIntent = useCreateSetupIntent();
  const { toast } = useToast();

  // Fetch setup intent when modal opens
  useEffect(() => {
    if (!studentId) {
      if (isOpen) {
        toast({
          title: 'Error',
          description: 'Student ID not found. Please refresh the page.',
          variant: 'destructive',
        });
        onClose();
      }
      return;
    }

    if (isOpen && !clientSecret && !isLoading) {
      setIsLoading(true);
      createSetupIntent.mutate(studentId, {
        onSuccess: (data) => {
          setClientSecret(data.client_secret);
          setIsLoading(false);
        },
        onError: (error: any) => {
          toast({
            title: 'Error',
            description: error.message || 'Failed to initialize payment method setup',
            variant: 'destructive',
          });
          setIsLoading(false);
          onClose();
        }
      });
    }
    
    // Reset state when modal closes
    if (!isOpen && clientSecret) {
      setClientSecret(null);
    }
  }, [isOpen, studentId]); // Only depend on isOpen and studentId

  const handleSuccess = useCallback(() => {
    setClientSecret(null);
    // Don't refetch here - let the real-time subscription handle the update
    // The optimistic update is already in the cache
    onClose();
  }, [onClose]);

  const handleCancel = useCallback(() => {
    setClientSecret(null);
    onClose();
  }, [onClose]);

  const elementsOptions: StripeElementsOptions = useMemo(() => ({
    clientSecret: clientSecret || undefined,
    appearance: {
      theme: 'stripe',
    },
  }), [clientSecret]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Add Payment Method
          </DialogTitle>
          <DialogDescription>
            Add a new card to your account. Your card information is securely processed by Stripe.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          </div>
        )}

        {!isLoading && clientSecret && (
          <Elements stripe={getStripePromise()} options={elementsOptions}>
            <PaymentForm 
              onSuccess={handleSuccess} 
              onCancel={handleCancel}
              clientSecret={clientSecret}
              studentId={studentId}
            />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  );
}

