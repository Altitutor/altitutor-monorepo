import { useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import { paymentMethodsApi } from '../api/payment-methods';

// Pre-load Stripe.js instance
let stripePromise: Promise<any> | null = null;

function getStripePromise() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');
  }
  return stripePromise;
}

/**
 * Pre-warms Stripe.js and setup intent when billing page loads
 * This improves perceived performance when user clicks "Add Payment Method"
 */
export function usePreWarmBilling() {
  const { user } = useAuthStore();
  const studentId = user?.user_metadata?.student_id;

  useEffect(() => {
    if (!studentId) return;

    // Pre-load Stripe.js
    getStripePromise();

    // Pre-fetch setup intent (but don't use it yet - just warm up the API)
    // This helps reduce latency when user actually clicks "Add Payment Method"
    const preFetchSetupIntent = async () => {
      try {
        await paymentMethodsApi.createSetupIntent(studentId);
      } catch (error) {
        // Silently fail - this is just pre-warming, not critical
        // The actual setup intent will be created when modal opens
      }
    };

    // Delay pre-fetch slightly to not block initial render
    const timeoutId = setTimeout(preFetchSetupIntent, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [studentId]);
}

