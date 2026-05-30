import { NextResponse } from 'next/server';
import { fetchAllStaffTierSummaries } from '@/features/pay-tiers/server/payTierService';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';

export async function GET() {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  try {
    const staff = await fetchAllStaffTierSummaries(auth.admin);
    return NextResponse.json({ staff });
  } catch (e) {
    console.error('GET pay-tiers/staff:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load staff tiers' },
      { status: 500 }
    );
  }
}
