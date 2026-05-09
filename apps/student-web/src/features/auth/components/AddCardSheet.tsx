'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Button,
  useToast,
} from '@altitutor/ui';
import { CreditCard, Loader2 } from 'lucide-react';
import { paymentMethodsApi } from '@/shared/api';
import { studentBtnOutline, studentBtnPrimary } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';

// Initialize Stripe outside of component to avoid recreating on every render
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface AddCardSheetProps {
  studentId: string;
  onSuccess?: () => void;
}

function AddCardForm({ studentId: _studentId, onSuccess, onClose }: AddCardSheetProps & { onClose: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);

    try {
      // Confirm the payment with Stripe
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message);
      }

      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard`,
        },
        redirect: 'if_required',
      });

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: 'Success',
        description: 'Your payment method has been added and verified successfully.',
      });

      onClose();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to add card:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add payment method',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <div className="flex gap-2">
        <Button type="submit" disabled={!stripe || loading} className={cn(studentBtnPrimary, 'flex-1')}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            'Add Card'
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={studentBtnOutline}
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AddCardSheet({ studentId, onSuccess }: AddCardSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);

    if (open && !clientSecret) {
      // Initialize card setup when dialog opens
      setLoading(true);
      try {
        const data = await paymentMethodsApi.createSetupIntent(studentId);
        setClientSecret(data.client_secret);
      } catch (error) {
        console.error('Failed to initialize card setup:', error);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to initialize card setup',
          variant: 'destructive',
        });
        setIsOpen(false);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setClientSecret(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className={cn(studentBtnPrimary, 'w-full')}>
          <CreditCard className="mr-2 h-4 w-4" />
          Add Payment Method
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Payment Method</DialogTitle>
          <DialogDescription>
            Add a card for automatic session billing. We'll verify your card with a $0.50 charge that will be immediately refunded.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : clientSecret ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                },
              }}
            >
              <AddCardForm studentId={studentId} onSuccess={onSuccess} onClose={handleClose} />
            </Elements>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

