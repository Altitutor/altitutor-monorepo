'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Button, Label, Checkbox, Dialog, DialogContent, DialogHeader, DialogTitle, PolicyViewer, FormControl, FormField, FormItem, FormMessage } from '@altitutor/ui';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@altitutor/ui';
import type { RegistrationFormValues } from '../validations';

interface RegistrationStep4PaymentMethodProps {
  form: UseFormReturn<RegistrationFormValues>;
  token: string;
  studentId: string;
  preloadedClientSecret?: string | null;
}

// Use pre-loaded Stripe instance
import type { Stripe } from '@stripe/stripe-js';

function BillingPolicyCheckbox({ form }: { form: UseFormReturn<RegistrationFormValues> }) {
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyContent, setPolicyContent] = useState<unknown>(null);
  const [policyLoading, setPolicyLoading] = useState(false);

  const fetchPolicy = useCallback(async () => {
    if (policyContent !== null) return;
    setPolicyLoading(true);
    try {
      const res = await fetch('/api/policies/billing');
      const data = await res.json();
      setPolicyContent(data.content ?? null);
    } catch {
      setPolicyContent(null);
    } finally {
      setPolicyLoading(false);
    }
  }, [policyContent]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setPolicyOpen(open);
      if (open) fetchPolicy();
    },
    [fetchPolicy]
  );

  return (
    <>
      <FormField
        control={form.control}
        name="billingPolicyAgreed"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-start gap-3">
              <FormControl>
                <Checkbox
                  id="billingPolicyAgreed"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              </FormControl>
              <label
                htmlFor="billingPolicyAgreed"
                className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                By registering as a student at Altitutor, I agree to Altitutor&apos;s{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleOpenChange(true);
                  }}
                  className="text-primary underline hover:no-underline"
                >
                  billing policy
                </button>
                .
              </label>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
      <Dialog open={policyOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Billing Policy</DialogTitle>
          </DialogHeader>
          {policyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <PolicyViewer content={policyContent} className="mt-4" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

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
          <div className="rounded-md p-3 bg-white dark:bg-gray-800">
            <CardExpiryElement 
              id="cardExpiry"
              options={elementOptions}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cardCvc">CVC</Label>
          <div className="rounded-md p-3 bg-white dark:bg-gray-800">
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
  preloadedClientSecret,
}: RegistrationStep4PaymentMethodProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(preloadedClientSecret || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const { toast } = useToast();

  // Check if payment method is already verified
  const paymentMethodVerified = form.watch('paymentMethodVerified');

  // Use preloaded client secret if available, otherwise fetch
  useEffect(() => {
    if (!studentId || paymentMethodVerified) {
      setIsVerified(true);
      return;
    }

    // If we already have a client secret (preloaded), use it
    if (clientSecret) {
      setIsLoading(false);
      return;
    }

    // Only fetch if we don't have a client secret and we're not already loading
    if (isLoading) {
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

  // Update client secret if preloaded value changes
  useEffect(() => {
    if (preloadedClientSecret && !clientSecret) {
      setClientSecret(preloadedClientSecret);
    }
  }, [preloadedClientSecret, clientSecret]);

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

  const paymentMethodError = form.formState.errors.paymentMethodVerified?.message;

  if (paymentMethodVerified || isVerified) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Payment Method</h3>
          <p className="text-sm text-muted-foreground mt-1">
          Add a payment method to pay for sessions.
          </p>
        </div>

        {paymentMethodError && (
          <p className="text-sm text-destructive">{paymentMethodError}</p>
        )}

        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-900 dark:text-green-100">
              Payment Method Verified
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">
              Your payment method has been successfully added and verified.
            </p>
          </div>
        </div>

        <BillingPolicyCheckbox form={form} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Payment Method</h3>
        <p className="text-sm text-muted-foreground mt-1">
        Add a payment method to pay for sessions. Your card will be verified but not charged until you are added to a class.
        </p>
      </div>

      {paymentMethodError && (
        <p className="text-sm text-destructive">{paymentMethodError}</p>
      )}

      {isLoading && (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </div>
      )}

      {!isLoading && clientSecret && (
        <div className="space-y-6">
          <Elements stripe={getStripePromise()} options={elementsOptions}>
            <PaymentForm 
              onSuccess={handleSuccess} 
              clientSecret={clientSecret}
              studentId={studentId}
              token={token}
            />
          </Elements>

          <BillingPolicyCheckbox form={form} />
        </div>
      )}
    </div>
  );
}

