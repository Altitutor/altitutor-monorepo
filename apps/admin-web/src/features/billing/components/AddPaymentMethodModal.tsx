'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Button, Label } from '@altitutor/ui';
import { loadStripe, StripeElementsOptions, type Stripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2, CreditCard } from 'lucide-react';
import { useToast } from '@altitutor/ui';
import { paymentMethodsApi } from '../api/payment-methods';
import { getErrorMessage } from '@/shared/utils';

// Use pre-loaded Stripe instance
let stripePromise: Promise<Stripe | null> | null = null;
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
  studentEmail?: string;
  studentName?: string;
  onSuccess?: () => void;
}

function PaymentForm({ 
  onSuccess, 
  onCancel, 
  clientSecret, 
  studentId: _studentId 
}: { 
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
        toast({
          title: 'Success',
          description: 'Payment method added successfully',
        });
        
        onSuccess();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
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

export function AddPaymentMethodModal({ 
  isOpen, 
  onClose, 
  studentId, 
  studentEmail,
  studentName,
  onSuccess 
}: AddPaymentMethodModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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
      paymentMethodsApi.createSetupIntent(studentId, studentEmail, studentName)
        .then((data) => {
          setClientSecret(data.client_secret);
          setIsLoading(false);
        })
        .catch((error: unknown) => {
          const errorMessage = getErrorMessage(error);
          toast({
            title: 'Error',
            description: errorMessage || 'Failed to initialize payment method setup',
            variant: 'destructive',
          });
          setIsLoading(false);
          onClose();
        });
    }
    
    // Reset state when modal closes
    if (!isOpen && clientSecret) {
      setClientSecret(null);
    }
  }, [isOpen, studentId, studentEmail, studentName]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSuccess = useCallback(() => {
    setClientSecret(null);
    onSuccess?.();
    onClose();
  }, [onClose, onSuccess]);

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
            Add a new card for this student. Card information is securely processed by Stripe.
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

