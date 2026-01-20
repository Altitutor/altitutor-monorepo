import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import { getErrorMessage } from '@/shared/utils';

export async function POST(request: NextRequest) {
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

    // Verify admin client is available
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json(
        { error: 'Missing required field: studentId' },
        { status: 400 }
      );
    }

    // Delete students_billing record (this will cascade delete payment methods due to ON DELETE CASCADE)
    const { error: deleteError } = await supabaseAdmin
      .from('students_billing')
      .delete()
      .eq('student_id', studentId);

    if (deleteError) {
      console.error('Error unlinking Stripe customer:', deleteError);
      return NextResponse.json(
        { error: 'Failed to unlink Stripe customer: ' + deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error('Error unlinking Stripe customer:', error);
    return NextResponse.json(
      { error: errorMessage || 'Failed to unlink Stripe customer' },
      { status: 500 }
    );
  }
}


