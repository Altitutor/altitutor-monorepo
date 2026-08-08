import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/shared/lib/supabase/server';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

type FunctionErrorResponse = {
  status: number;
  clone: () => { json: () => Promise<unknown> };
};

function hasFunctionErrorResponse(
  error: unknown
): error is { context: FunctionErrorResponse } {
  if (!error || typeof error !== 'object' || !('context' in error)) {
    return false;
  }

  const { context } = error;
  return Boolean(
    context &&
      typeof context === 'object' &&
      'status' in context &&
      typeof context.status === 'number' &&
      'clone' in context &&
      typeof context.clone === 'function'
  );
}

async function isPendingPaymentMethodVerification(error: unknown, action: unknown) {
  if (
    action !== 'verify_payment_method' ||
    !hasFunctionErrorResponse(error) ||
    error.context.status !== 400
  ) {
    return false;
  }

  try {
    const payload = await error.context.clone().json();
    return Boolean(
      payload &&
        typeof payload === 'object' &&
        'verified' in payload &&
        payload.verified === false &&
        'error' in payload &&
        payload.error === 'No payment method found'
    );
  } catch {
    return false;
  }
}

/**
 * Proxy endpoint for registration payment method setup
 * Uses Supabase Edge Function which has Stripe secret key configured in Supabase
 * This avoids needing STRIPE_SECRET_KEY in Next.js environment variables
 * 
 * Note: This endpoint is public (no auth required) - security is handled by
 * the edge function validating the registration token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, action } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Missing token' },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action parameter' },
        { status: 400 }
      );
    }

    // Use server Supabase client to invoke the edge function
    // The edge function will handle token validation and Stripe operations
    // No auth headers needed - edge function validates registrationToken instead
    const supabase = getServerSupabaseClient();
    
    const { data, error } = await supabase.functions.invoke('payment-methods', {
      body: {
        action,
        registrationToken: token, // Pass token for registration flow
      }
    });

    if (error) {
      // Older deployments returned a 400 while Stripe's webhook was still
      // persisting the payment method. This is an expected polling state.
      if (await isPendingPaymentMethodVerification(error, action)) {
        return NextResponse.json({ verified: false });
      }

      console.error('[register/payment-method] Edge function error', error);
      captureApiError(error, '/api/register/payment-method');
      return NextResponse.json(
        { error: error.message || 'Failed to process payment method request' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'No data returned from payment method service' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    captureApiError(error, "/api/register/payment-method");
    console.error('[register/payment-method] error', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
