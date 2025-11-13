import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify user is authenticated and has admin role
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or staff with appropriate permissions
    const { data: currentUserStaff, error: staffError } = await supabase
      .from('staff')
      .select('role')
      .eq('user_id', user.id)
      .single<{ role: string }>();

    if (staffError || !currentUserStaff || currentUserStaff.role !== 'ADMINSTAFF') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Verify admin client is available
    if (!supabaseAdmin) {
      console.error('Admin client not initialized - missing SUPABASE_SERVICE_ROLE_KEY');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const studentId = params.id;

    // Get student record to get user_id for auth deletion
    const { data: student, error: fetchError } = await supabase
      .from('students')
      .select('user_id')
      .eq('id', studentId)
      .single<{ user_id: string | null }>();

    if (fetchError) {
      return NextResponse.json(
        { error: `Failed to fetch student: ${fetchError.message}` },
        { status: 404 }
      );
    }

    // Delete student record (this will trigger cascade delete for related records)
    const { error: deleteError } = await supabase
      .from('students')
      .delete()
      .eq('id', studentId);

    if (deleteError) {
      return NextResponse.json(
        { error: `Failed to delete student: ${deleteError.message}` },
        { status: 500 }
      );
    }

    // Delete auth user if user_id exists
    if (student.user_id) {
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(student.user_id);
      if (authDeleteError) {
        console.warn(`Failed to delete auth user ${student.user_id}: ${authDeleteError.message}`);
        // Don't throw here as the student record is already deleted
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error deleting student:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}





