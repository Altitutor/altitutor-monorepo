import { NextRequest, NextResponse } from 'next/server';
import { requireAdminStaff } from '@/features/pay-tiers/server/requireAdminStaff';
import type { Json } from '@altitutor/shared';

type RequirementKind =
  | 'TENURE_DAYS'
  | 'TENURE_MONTHS'
  | 'TIME_SINCE_LAST_PROMOTION'
  | 'SESSION_COUNT';

const TENURE_KINDS: RequirementKind[] = ['TENURE_DAYS', 'TENURE_MONTHS'];

function isTenureKind(kind: string): kind is RequirementKind {
  return TENURE_KINDS.includes(kind as RequirementKind);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { tierNumber: string } }
) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const tierNumber = Number(params.tierNumber);
  const { data, error } = await auth.admin
    .from('staff_pay_tier_requirements')
    .select('*')
    .eq('tier_number', tierNumber)
    .order('sort_order');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requirements: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { tierNumber: string } }
) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const tierNumber = Number(params.tierNumber);
  const body = (await request.json()) as {
    requirement_kind?: RequirementKind;
    params?: Record<string, unknown>;
    sort_order?: number;
  };
  if (!body.requirement_kind) {
    return NextResponse.json({ error: 'requirement_kind is required' }, { status: 400 });
  }

  if (isTenureKind(body.requirement_kind)) {
    const { data: existingTenure, error: tenureCheckError } = await auth.admin
      .from('staff_pay_tier_requirements')
      .select('id')
      .eq('tier_number', tierNumber)
      .in('requirement_kind', TENURE_KINDS);
    if (tenureCheckError) {
      return NextResponse.json({ error: tenureCheckError.message }, { status: 500 });
    }
    if (existingTenure && existingTenure.length > 0) {
      return NextResponse.json(
        { error: 'This tier already has a tenure requirement. Edit the existing one.' },
        { status: 400 }
      );
    }
  }

  if (body.requirement_kind === 'TIME_SINCE_LAST_PROMOTION') {
    const { data: existingTimeSince, error: timeSinceCheckError } = await auth.admin
      .from('staff_pay_tier_requirements')
      .select('id')
      .eq('tier_number', tierNumber)
      .eq('requirement_kind', 'TIME_SINCE_LAST_PROMOTION');
    if (timeSinceCheckError) {
      return NextResponse.json({ error: timeSinceCheckError.message }, { status: 500 });
    }
    if (existingTimeSince && existingTimeSince.length > 0) {
      return NextResponse.json(
        { error: 'This tier already has a time-since-promotion requirement. Edit the existing one.' },
        { status: 400 }
      );
    }
  }

  const { data, error } = await auth.admin
    .from('staff_pay_tier_requirements')
    .insert({
      tier_number: tierNumber,
      requirement_kind: body.requirement_kind,
      params: (body.params ?? {}) as Json,
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requirement: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { tierNumber: string } }
) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const tierNumber = Number(params.tierNumber);
  const body = (await request.json()) as {
    id?: string;
    params?: Record<string, unknown>;
    requirement_kind?: RequirementKind;
  };
  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }
  if (body.params === undefined && body.requirement_kind === undefined) {
    return NextResponse.json({ error: 'params or requirement_kind required' }, { status: 400 });
  }

  if (body.requirement_kind && isTenureKind(body.requirement_kind)) {
    const { data: otherTenure, error: tenureCheckError } = await auth.admin
      .from('staff_pay_tier_requirements')
      .select('id')
      .eq('tier_number', tierNumber)
      .in('requirement_kind', TENURE_KINDS)
      .neq('id', body.id);
    if (tenureCheckError) {
      return NextResponse.json({ error: tenureCheckError.message }, { status: 500 });
    }
    if (otherTenure && otherTenure.length > 0) {
      return NextResponse.json(
        { error: 'Only one tenure requirement is allowed per tier' },
        { status: 400 }
      );
    }
  }

  if (body.requirement_kind === 'TIME_SINCE_LAST_PROMOTION') {
    const { data: otherTimeSince, error: timeSinceCheckError } = await auth.admin
      .from('staff_pay_tier_requirements')
      .select('id')
      .eq('tier_number', tierNumber)
      .eq('requirement_kind', 'TIME_SINCE_LAST_PROMOTION')
      .neq('id', body.id);
    if (timeSinceCheckError) {
      return NextResponse.json({ error: timeSinceCheckError.message }, { status: 500 });
    }
    if (otherTimeSince && otherTimeSince.length > 0) {
      return NextResponse.json(
        { error: 'Only one time-since-promotion requirement is allowed per tier' },
        { status: 400 }
      );
    }
  }

  const updates: {
    params?: Json;
    requirement_kind?: RequirementKind;
  } = {};
  if (body.params !== undefined) updates.params = body.params as Json;
  if (body.requirement_kind !== undefined) updates.requirement_kind = body.requirement_kind;

  const { data, error } = await auth.admin
    .from('staff_pay_tier_requirements')
    .update(updates)
    .eq('id', body.id)
    .eq('tier_number', tierNumber)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requirement: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { tierNumber: string } }
) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const requirementId = searchParams.get('id');
  if (!requirementId) {
    return NextResponse.json({ error: 'id query param required' }, { status: 400 });
  }
  const tierNumber = Number(params.tierNumber);
  const { error } = await auth.admin
    .from('staff_pay_tier_requirements')
    .delete()
    .eq('id', requirementId)
    .eq('tier_number', tierNumber);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
