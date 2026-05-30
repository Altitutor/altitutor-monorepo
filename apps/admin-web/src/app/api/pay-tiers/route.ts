import { NextRequest, NextResponse } from 'next/server';
import { fetchPayTiers } from '@/features/pay-tiers/server/payTierService';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';

export async function GET() {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  try {
    const tiers = await fetchPayTiers(auth.admin);
    return NextResponse.json({ tiers });
  } catch (e) {
    console.error('GET pay-tiers:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load tiers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as {
      tier_number?: number;
      name?: string | null;
      base_pay_rate_cents?: number;
      currency?: string;
    };
    if (!body.tier_number || body.base_pay_rate_cents == null) {
      return NextResponse.json({ error: 'tier_number and base_pay_rate_cents are required' }, { status: 400 });
    }
    const { data, error } = await auth.admin
      .from('staff_pay_tiers')
      .insert({
        tier_number: body.tier_number,
        name: body.name ?? null,
        base_pay_rate_cents: body.base_pay_rate_cents,
        currency: body.currency ?? 'AUD',
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tier: data });
  } catch (e) {
    console.error('POST pay-tiers:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create tier' },
      { status: 500 }
    );
  }
}
