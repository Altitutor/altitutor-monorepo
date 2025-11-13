import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import type { Database } from '@altitutor/shared';

export async function PATCH(
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

    // Check if user is admin
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
    const body = await request.json();

    // Get current student record to get user_id for auth update
    const { data: currentStudent, error: fetchError} = await supabase
      .from('students')
      .select('user_id, email')
      .eq('id', studentId)
      .single<{ user_id: string | null; email: string }>();

    if (fetchError || !currentStudent) {
      return NextResponse.json(
        { error: `Failed to fetch current student: ${fetchError?.message || 'Student not found'}` },
        { status: 404 }
      );
    }

    // Update auth user if user_id exists and email or phone changed
    if (currentStudent.user_id && (body.email || body.phone)) {
      const authUpdateData: { 
        email?: string;
        phone?: string;
      } = {};
      
      if (body.email) {
        authUpdateData.email = body.email;
      }
      
      // Update phone with validation
      if (body.phone) {
        // Clean and validate phone number (E.164 format: +[country code][number])
        const cleanedPhone = body.phone.replace(/[\s\-\(\)]/g, '');
        
        // Check if it's a valid E.164 format (starts with + and has 10-15 digits)
        const phoneRegex = /^\+[1-9]\d{9,14}$/;
        
        if (phoneRegex.test(cleanedPhone)) {
          authUpdateData.phone = cleanedPhone;
        } else {
          console.warn(`Invalid phone format for student ${studentId}: ${body.phone}. Skipping auth.users phone update.`);
          // Continue without failing - phone will still update in students table
        }
      }

      // Only call auth update if we have something to update
      if (authUpdateData.email || authUpdateData.phone) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          currentStudent.user_id,
          authUpdateData
        );

        if (authError) {
          console.error('Auth update error:', authError);
          return NextResponse.json(
            { error: `Failed to update auth user: ${authError.message}` },
            { status: 500 }
          );
        }
      }
    }

    // Update student record
    const { data: updatedStudent, error: updateError } = await supabase
      .from('students')
      // @ts-expect-error - TypeScript inference issue with Supabase client
      .update({
        first_name: body.first_name,
        last_name: body.last_name,
        email: body.email ?? undefined,
        phone: body.phone,
        status: body.status,
        curriculum: body.curriculum,
        year_level: body.year_level,
        school: body.school,
        availability_monday: body.availability_monday,
        availability_tuesday: body.availability_tuesday,
        availability_wednesday: body.availability_wednesday,
        availability_thursday: body.availability_thursday,
        availability_friday: body.availability_friday,
        availability_saturday_am: body.availability_saturday_am,
        availability_saturday_pm: body.availability_saturday_pm,
        availability_sunday_am: body.availability_sunday_am,
        availability_sunday_pm: body.availability_sunday_pm,
      })
      .eq('id', studentId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update student: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: updatedStudent }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error updating student:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

