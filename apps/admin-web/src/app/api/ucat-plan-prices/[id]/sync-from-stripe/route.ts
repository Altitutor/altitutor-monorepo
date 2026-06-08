import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import { getErrorMessage } from '@/shared/utils';

/**
 * POST /api/ucat-plan-prices/[id]/sync-from-stripe
 * Fetches unit amount from Stripe and updates base_price_cents.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const supabase = createClient();
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('role, status')
      .eq('user_id', session.user.id)
      .single<{ role: string; status: string }>();

    if (
      staffError ||
      !staffData ||
      staffData.role !== 'ADMINSTAFF' ||
      staffData.status !== 'ACTIVE'
    ) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
    }

    const { data: row, error: rowError } = await supabaseAdmin
      .from('ucat_plan_prices')
      .select('id, stripe_price_id')
      .eq('id', id)
      .maybeSingle();

    if (rowError || !row) {
      return NextResponse.json({ error: 'Plan price not found' }, { status: 404 });
    }

    const priceId = row.stripe_price_id?.trim();
    if (!priceId) {
      return NextResponse.json(
        { error: 'No Stripe price ID configured for this row' },
        { status: 400 },
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' });
    const stripePrice = await stripe.prices.retrieve(priceId);

    const unitAmount = stripePrice.unit_amount;
    if (unitAmount == null || unitAmount < 0) {
      return NextResponse.json(
        { error: 'Stripe price has no fixed unit amount' },
        { status: 400 },
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from('ucat_plan_prices')
      .update({
        base_price_cents: unitAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ base_price_cents: unitAmount });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) || 'Failed to sync from Stripe' },
      { status: 500 },
    );
  }
}
