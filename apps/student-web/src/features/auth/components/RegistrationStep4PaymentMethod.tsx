'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Button, Label } from '@altitutor/ui';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@altitutor/ui';

type RegistrationFormValues = {
  student: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    school?: string;
    curriculum?: 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY';
    year_level?: number;
    subject_ids: string[];
  };
  parents: Array<{
    id?: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  }>;
  availability: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday_am: boolean;
    saturday_pm: boolean;
    sunday_am: boolean;
    sunday_pm: boolean;
  };
  password: string;
  confirmPassword: string;
  paymentMethodVerified: boolean;
};

interface RegistrationStep4PaymentMethodProps {
  form: UseFormReturn<RegistrationFormValues>;
  token: string;
  studentId: string;
}

// Use pre-loaded Stripe instance
import type { Stripe } from '@stripe/stripe-js';
let stripePromise: Promise<Stripe | null> | null = null;
function getStripePromise() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');
  }
  return stripePromise;
}

function PaymentForm({ 
  onSuccess, 
  clientSecret, 
  studentId: _studentId,
  token 
}: { 
  onSuccess: () => void; 
  clientSecret: string;
  studentId: string;
  token: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Detect dark mode dynamically
  const isDarkMode = typeof window !== 'undefined' && 
    document.documentElement.classList.contains('dark');

  const elementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: isDarkMode ? '#ffffff' : '#1a1a1a',
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
        // Wait a moment for webhook to process, then verify
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify payment method was saved
        const verifyResponse = await fetch('/api/register/payment-method', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            action: 'verify_payment_method',
          }),
        });

        const verifyData = await verifyResponse.json();

        if (!verifyData.verified) {
          // Payment method might still be processing, wait a bit more
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const retryResponse = await fetch('/api/register/payment-method', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token,
              action: 'verify_payment_method',
            }),
          });

          const retryData = await retryResponse.json();
          
          if (!retryData.verified) {
            setError('Payment method added but verification failed. Please try again.');
            setIsProcessing(false);
            return;
          }
        }

        toast({
          title: 'Success',
          description: 'Payment method added and verified successfully',
        });
        
        onSuccess();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cardNumber">Card Number</Label>
        <div className="rounded-md p-3 bg-white dark:bg-gray-800">
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

      <Button
        type="submit"
        disabled={isProcessing || !stripe || !elements}
        className="w-full"
      >
        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isProcessing ? 'Verifying...' : 'Add & Verify Payment Method'}
      </Button>
    </form>
  );
}

export function RegistrationStep4PaymentMethod({
  form,
  token,
  studentId,
}: RegistrationStep4PaymentMethodProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const { toast } = useToast();

  // Check if payment method is already verified
  const paymentMethodVerified = form.watch('paymentMethodVerified');

  // Fetch setup intent when component mounts
  useEffect(() => {
    if (!studentId || paymentMethodVerified) {
      setIsVerified(true);
      return;
    }

    // Only fetch if we don't have a client secret and we're not already loading
    if (clientSecret || isLoading) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    
    fetch('/api/register/payment-method', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        action: 'create_setup_intent',
      }),
    })
      .then(async (res) => {
        if (cancelled) return;
        
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to initialize payment method setup');
        }
        
        if (!cancelled) {
          setClientSecret(data.client_secret);
          setIsLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize payment method setup';
        console.error('[RegistrationStep4PaymentMethod] Error fetching setup intent:', error);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, token, paymentMethodVerified]); // clientSecret and isLoading intentionally excluded to prevent loops

  const handleSuccess = useCallback(() => {
    setIsVerified(true);
    form.setValue('paymentMethodVerified', true);
    setClientSecret(null);
  }, [form]);

  const elementsOptions: StripeElementsOptions = useMemo(() => ({
    clientSecret: clientSecret || undefined,
    appearance: {
      theme: 'stripe',
    },
  }), [clientSecret]);

  if (paymentMethodVerified || isVerified) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Payment Method</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add a payment method to complete your registration.
          </p>
        </div>

        <div className="flex items-center gap-3 p-4 border rounded-lg bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          <div>
            <p className="font-medium text-green-900 dark:text-green-100">
              Payment Method Verified
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">
              Your payment method has been successfully added and verified.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Payment Method</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Add a payment method to complete your registration. Your card will be verified but not charged.
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </div>
      )}

      {!isLoading && clientSecret && (
        <div className="border rounded-lg p-6">
          <Elements stripe={getStripePromise()} options={elementsOptions}>
            <PaymentForm 
              onSuccess={handleSuccess} 
              clientSecret={clientSecret}
              studentId={studentId}
              token={token}
            />
          </Elements>
        </div>
      )}
    </div>
  );
}

