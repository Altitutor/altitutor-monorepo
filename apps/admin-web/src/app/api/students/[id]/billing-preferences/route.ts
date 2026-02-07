import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getErrorMessage } from '@/shared/utils';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const studentId = params.id;

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

    // Parse request body
    const body = await request.json();
    const { auto_bill_enabled, invoice_email_to_student, invoice_email_to_parents } = body;

    // Validate input
    if (
      auto_bill_enabled !== undefined && typeof auto_bill_enabled !== 'boolean' ||
      invoice_email_to_student !== undefined && typeof invoice_email_to_student !== 'boolean' ||
      invoice_email_to_parents !== undefined && typeof invoice_email_to_parents !== 'boolean'
    ) {
      return NextResponse.json(
        { error: 'Invalid input: all fields must be boolean or undefined' },
        { status: 400 }
      );
    }

    // Check if student exists
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Check if billing account exists, create if not
    const { data: billing, error: billingCheckError } = await supabase
      .from('students_billing')
      .select('student_id')
      .eq('student_id', studentId)
      .maybeSingle();

    if (billingCheckError) {
      return NextResponse.json(
        { error: 'Failed to check billing account' },
        { status: 500 }
      );
    }

    // Build update object (only include fields that are provided)
    const updateData: {
      auto_bill_enabled?: boolean;
      invoice_email_to_student?: boolean;
      invoice_email_to_parents?: boolean;
    } = {};

    if (auto_bill_enabled !== undefined) {
      updateData.auto_bill_enabled = auto_bill_enabled;
    }
    if (invoice_email_to_student !== undefined) {
      updateData.invoice_email_to_student = invoice_email_to_student;
    }
    if (invoice_email_to_parents !== undefined) {
      updateData.invoice_email_to_parents = invoice_email_to_parents;
    }

    // If no fields to update, return success
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true, message: 'No changes to apply' });
    }

    // Update or insert billing preferences
    // Use upsert to handle case where billing account doesn't exist yet
    // Note: This requires stripe_customer_id, so we'll need to handle that case
    if (!billing) {
      // Billing account doesn't exist - we can't create it here without Stripe customer
      // Return error asking to create billing account first
      return NextResponse.json(
        { error: 'Billing account does not exist. Please add a payment method first to create the billing account.' },
        { status: 400 }
      );
    }

    // Update existing billing account
    const { data: updatedBilling, error: updateError } = await supabase
      .from('students_billing')
      .update(updateData)
      .eq('student_id', studentId)
      .select('auto_bill_enabled, invoice_email_to_student, invoice_email_to_parents')
      .single();

    if (updateError) {
      console.error('[api/students/billing-preferences] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update billing preferences', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      billing_preferences: updatedBilling,
    });
  } catch (error) {
    console.error('[api/students/billing-preferences] Error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
