import { NextResponse } from 'next/server';
import { fetchStaffCheckIns } from '@/features/pay-tiers/server/payTierService';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';

export async function GET(
  _request: Request,
  { params }: { params: { staffId: string } }
) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  try {
    const checkIns = await fetchStaffCheckIns(auth.admin, params.staffId);
    return NextResponse.json({ checkIns });
  } catch (e) {
    console.error('GET pay-tiers/staff/check-ins:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load check-ins' },
      { status: 500 }
    );
  }
}
