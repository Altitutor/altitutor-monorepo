import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import Stripe from 'stripe';
import { getErrorMessage, getStripeErrorDetails } from '@/shared/utils';

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
        { error: 'Stripe not configured: STRIPE_SECRET_KEY environment variable is missing' },
        { status: 500 }
      );
    }

    if (!stripeSecretKey.startsWith('sk_')) {
      return NextResponse.json(
        { error: 'Stripe not configured: Invalid STRIPE_SECRET_KEY format' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' });

    // Get search query from URL params
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim() === '') {
      return NextResponse.json({ customers: [] });
    }

    const searchTerm = query.trim();

    // Determine search type: email, name, or customer ID
    let stripeQuery: string;
    
    // Check if it looks like a customer ID (starts with cus_)
    if (searchTerm.startsWith('cus_')) {
      // Try to retrieve directly by ID
      try {
        const customer = await stripe.customers.retrieve(searchTerm);
        if (customer.deleted) {
          return NextResponse.json({ customers: [] });
        }
        
        // Fetch payment methods for this customer
        const paymentMethods = await stripe.paymentMethods.list({
          customer: searchTerm,
          type: 'card',
          limit: 100,
        });

        const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method as string | undefined;

        return NextResponse.json({
          customers: [{
            id: customer.id,
            email: customer.email,
            name: customer.name,
            created: customer.created,
            metadata: customer.metadata,
            default_payment_method_id: defaultPaymentMethodId,
            payment_methods: paymentMethods.data.map((pm) => ({
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
          }],
        });
      } catch (error: unknown) {
        // If not found, return empty results
        const stripeDetails = getStripeErrorDetails(error);
        if (stripeDetails.statusCode === 404) {
          return NextResponse.json({ customers: [] });
        }
        throw error;
      }
    }
    
    // Check if it looks like an email
    if (searchTerm.includes('@')) {
      stripeQuery = `email:'${searchTerm.replace(/'/g, "\\'")}'`;
    } else {
      // Otherwise search by name
      stripeQuery = `name:'${searchTerm.replace(/'/g, "\\'")}'`;
    }

    // Search customers using Stripe Search API
    const searchResults = await stripe.customers.search({
      query: stripeQuery,
      limit: 100,
    });

    // Fetch payment methods for each customer found
    const customersWithPaymentMethods = await Promise.all(
      searchResults.data.map(async (customer) => {
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
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    const stripeDetails = getStripeErrorDetails(error);
    console.error('[stripe/customers/search] Error searching Stripe customers:', error);
    return NextResponse.json(
      { 
        error: errorMessage || 'Failed to search Stripe customers',
        details: process.env.NODE_ENV === 'development' ? stripeDetails : undefined,
      },
      { status: stripeDetails.statusCode || 500 }
    );
  }
}

