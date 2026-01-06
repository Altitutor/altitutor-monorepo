import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import Stripe from 'stripe';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated and has admin role
    const supabase = createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin staff
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('role, status')
      .eq('user_id', session.user.id)
      .single<{ role: string; status: string }>();

    if (staffError || !staffData || staffData.role !== 'ADMINSTAFF' || staffData.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get Stripe secret key
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' });

    // Fetch all customers with pagination
    const customers: Stripe.Customer[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params: Stripe.CustomerListParams = {
        limit: 100,
      };
      if (startingAfter) {
        params.starting_after = startingAfter;
      }

      const response = await stripe.customers.list(params);
      customers.push(...response.data);
      hasMore = response.has_more;
      if (response.data.length > 0) {
        startingAfter = response.data[response.data.length - 1].id;
      }
    }

    // Fetch payment methods for each customer
    // Note: This makes many API calls (one per customer) which can be slow
    // Stripe doesn't provide a bulk endpoint for payment methods
    const customersWithPaymentMethods = await Promise.all(
      customers.map(async (customer) => {
        // Get default payment method from customer
        const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method as string | undefined;

        // Fetch payment methods with pagination
        const paymentMethods: Stripe.PaymentMethod[] = [];
        let hasMore = true;
        let startingAfter: string | undefined;

        while (hasMore) {
          const params: Stripe.PaymentMethodListParams = {
            customer: customer.id,
            type: 'card',
            limit: 100,
          };
          if (startingAfter) {
            params.starting_after = startingAfter;
          }

          const response = await stripe.paymentMethods.list(params);
          paymentMethods.push(...response.data);
          hasMore = response.has_more;
          if (response.data.length > 0) {
            startingAfter = response.data[response.data.length - 1].id;
          }
        }

        return {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          created: customer.created,
          metadata: customer.metadata,
          default_payment_method_id: defaultPaymentMethodId,
          payment_methods: paymentMethods.map((pm) => ({
            id: pm.id,
            type: pm.type,
            is_default: pm.id === defaultPaymentMethodId,
            card: pm.card
              ? {
                  brand: pm.card.brand,
                  last4: pm.card.last4,
                  exp_month: pm.card.exp_month,
                  exp_year: pm.card.exp_year,
                  country: pm.card.country,
                }
              : null,
          })),
        };
      })
    );

    return NextResponse.json({ customers: customersWithPaymentMethods });
  } catch (error: any) {
    console.error('Error fetching Stripe customers:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Stripe customers' },
      { status: 500 }
    );
  }
}

