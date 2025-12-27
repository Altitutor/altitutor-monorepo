import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import type { Database } from '@altitutor/shared';

type VStudentProfile = Database['public']['Views']['vstudent_profile']['Row'];

// Whitelist of fields that students are allowed to update
const ALLOWED_UPDATE_FIELDS = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'school',
  'curriculum',
  'year_level',
  'availability_monday',
  'availability_tuesday',
  'availability_wednesday',
  'availability_thursday',
  'availability_friday',
  'availability_saturday_am',
  'availability_saturday_pm',
  'availability_sunday_am',
  'availability_sunday_pm',
] as const;

type AllowedField = typeof ALLOWED_UPDATE_FIELDS[number];

/**
 * PATCH /api/profile
 * Update student's own profile
 * 
 * Authorization:
 * - User must be a student (checked via is_student())
 * - Can only update whitelisted fields
 * - Updates auth user email/phone if changed
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get the authenticated user's supabase client
    const userClient = createClient();
    
    // Verify user is a student
    const { data: isStudent, error: studentCheckError } = await userClient.rpc('is_student');
    
    if (studentCheckError) {
      console.error('Error checking student status:', studentCheckError);
      return NextResponse.json(
        { error: 'Failed to verify student status' },
        { status: 500 }
      );
    }
    
    if (!isStudent) {
      return NextResponse.json(
        { error: 'Unauthorized: User is not a student' },
        { status: 403 }
      );
    }
    
    // Get current student's ID
    const { data: studentId, error: studentIdError } = await userClient.rpc('current_student_id');
    
    if (studentIdError || !studentId) {
      console.error('Error getting student ID:', studentIdError);
      return NextResponse.json(
        { error: 'Failed to get student ID' },
        { status: 500 }
      );
    }
    
    // Filter body to only include whitelisted fields
    const updates: Partial<Record<AllowedField, any>> = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (field in body) {
        updates[field] = body[field];
      }
    }
    
    // Check if there are any valid updates
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided for update' },
        { status: 400 }
      );
    }
    
    // Get current student record to check if email/phone changed
    const { data: currentStudent, error: fetchError } = await userClient
      .from('vstudent_profile')
      .select('email, phone, user_id')
      .maybeSingle();
    
    if (fetchError || !currentStudent) {
      return NextResponse.json(
        { error: 'Failed to fetch current student record' },
        { status: 500 }
      );
    }
    
    const studentData = currentStudent as Pick<VStudentProfile, 'email' | 'phone' | 'user_id'>;
    
    // Use service role client to update the students table
    const adminClient = getServerSupabaseAdmin();
    
    const { data, error } = await adminClient
      .from('students')
      .update(updates)
      .eq('id', studentId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating profile:', error);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }
    
    // Update auth user email/phone if changed
    if (studentData.user_id && (updates.email || updates.phone)) {
      const authUpdates: { email?: string; phone?: string } = {};
      if (updates.email && updates.email !== studentData.email) {
        authUpdates.email = updates.email;
      }
      if (updates.phone && updates.phone !== studentData.phone) {
        authUpdates.phone = updates.phone;
      }
      
      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await adminClient.auth.admin.updateUserById(
          studentData.user_id,
          authUpdates
        );
        
        if (authError) {
          console.error('Error updating auth user:', authError);
          // Don't fail the request, but log the error
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        school: data.school,
        curriculum: data.curriculum,
        year_level: data.year_level,
        availability_monday: data.availability_monday,
        availability_tuesday: data.availability_tuesday,
        availability_wednesday: data.availability_wednesday,
        availability_thursday: data.availability_thursday,
        availability_friday: data.availability_friday,
        availability_saturday_am: data.availability_saturday_am,
        availability_saturday_pm: data.availability_saturday_pm,
        availability_sunday_am: data.availability_sunday_am,
        availability_sunday_pm: data.availability_sunday_pm,
        updated_at: data.updated_at,
      },
      message: 'Profile updated successfully',
    });
    
  } catch (error) {
    console.error('Error in PATCH /api/profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/profile
 * Get student's own profile (alternative to using vstudent_profile view directly)
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user's supabase client
    const userClient = createClient();
    
    // Verify user is a student
    const { data: isStudent, error: studentCheckError } = await userClient.rpc('is_student');
    
    if (studentCheckError) {
      console.error('Error checking student status:', studentCheckError);
      return NextResponse.json(
        { error: 'Failed to verify student status' },
        { status: 500 }
      );
    }
    
    if (!isStudent) {
      return NextResponse.json(
        { error: 'Unauthorized: User is not a student' },
        { status: 403 }
      );
    }
    
    // Query vstudent_profile view
    const { data, error } = await userClient
      .from('vstudent_profile')
      .select('*')
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching profile:', error);
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      );
    }
    
    if (!data) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data,
    });
    
  } catch (error) {
    console.error('Error in GET /api/profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

