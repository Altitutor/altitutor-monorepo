import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

// Mark this route as dynamic
export const dynamic = 'force-dynamic';

/**
 * Proxy endpoint for registration payment method setup
 * Uses Supabase Edge Function which has Stripe secret key configured in Supabase
 * This avoids needing STRIPE_SECRET_KEY in Next.js environment variables
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

    // Use Supabase client to invoke the edge function
    // The edge function will handle token validation and Stripe operations
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.functions.invoke('payment-methods', {
      body: {
        action,
        registrationToken: token, // Pass token for registration flow
      }
    });

    if (error) {
      console.error('[register/payment-method] Edge function error', error);
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
    console.error('[register/payment-method] error', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
