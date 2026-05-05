import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import type { Tables } from '@altitutor/shared';
import { getErrorMessage } from '@/shared/utils';

type StaffRoleStatus = Pick<Tables<'staff'>, 'role' | 'status'>;

/**
 * Soft-delete a void invoice and its line items (deleted_at).
 * Releases sessions_students unique slot for re-billing; does not call Stripe.
 */
export async function POST(request: NextRequest) {
  try {
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
      .maybeSingle();

    if (staffError || !staffData) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const staff = staffData as StaffRoleStatus;
    if (staff.role !== 'ADMINSTAFF' || staff.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const invoice_id = body?.invoice_id as string | undefined;

    if (!invoice_id) {
      return NextResponse.json({ error: 'invoice_id is required' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { data: inv, error: fetchErr } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!inv) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const row = inv as Tables<'invoices'>;
    if (row.deleted_at) {
      return NextResponse.json({ error: 'Invoice already archived' }, { status: 400 });
    }

    if (row.status !== 'void') {
      return NextResponse.json(
        { error: 'Only void invoices can be archived this way' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { error: itemsUpdErr } = await supabaseAdmin
      .from('invoice_items')
      .update({ deleted_at: now })
      .eq('invoice_id', invoice_id)
      .is('deleted_at', null);

    if (itemsUpdErr) throw itemsUpdErr;

    const { error: invUpdErr } = await supabaseAdmin
      .from('invoices')
      .update({ deleted_at: now })
      .eq('id', invoice_id)
      .is('deleted_at', null);

    if (invUpdErr) throw invUpdErr;

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('soft-delete-void-invoice:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
