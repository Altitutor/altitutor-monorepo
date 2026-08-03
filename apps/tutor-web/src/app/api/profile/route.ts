import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import type { Database } from '@altitutor/shared';

// Whitelist of fields that tutors are allowed to update
const ALLOWED_UPDATE_FIELDS = [
  'phone_number',
  'birthday',
  'profile_bio',
  'profile_image_file_id',
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

/**
 * PATCH /api/profile
 * Update tutor's own profile
 * 
 * Authorization:
 * - User must be an active tutor (checked via is_tutor())
 * - Can only update whitelisted fields
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get the authenticated user's supabase client
    const userClient = createClient();
    
    // Verify user is a tutor
    const { data: isTutor, error: tutorCheckError } = await userClient.rpc('is_tutor');
    
    if (tutorCheckError) {
      console.error('Error checking tutor status:', tutorCheckError);
      captureApiError(tutorCheckError, "/api/profile");
      return NextResponse.json(
        { error: 'Failed to verify tutor status' },
        { status: 500 }
      );
    }
    
    if (!isTutor) {
      return NextResponse.json(
        { error: 'Unauthorized: User is not a tutor' },
        { status: 403 }
      );
    }
    
    // Get current tutor's staff ID
    const { data: tutorId, error: tutorIdError } = await userClient.rpc('current_tutor_id');
    
    if (tutorIdError || !tutorId) {
      console.error('Error getting tutor ID:', tutorIdError);
      captureApiError(tutorIdError, "/api/profile");
      return NextResponse.json(
        { error: 'Failed to get tutor ID' },
        { status: 500 }
      );
    }
    
    // Filter body to only include whitelisted fields
    type StaffUpdate = Database['public']['Tables']['staff']['Update'];
    const updates: Partial<StaffUpdate> = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (field in body) {
        const value = body[field];
        // Type guard to ensure value is correct type
        if (field === 'phone_number' || field === 'birthday') {
          if (typeof value === 'string' || value === null) {
            updates[field] = value === '' ? null : value;
          }
        } else if (field === 'profile_bio' || field === 'profile_image_file_id') {
          if (typeof value === 'string' || value === null) {
            updates[field] = field === 'profile_bio' && typeof value === 'string'
              ? value.slice(0, 1200)
              : value;
          }
        } else {
          // All other fields are boolean | null
          if (typeof value === 'boolean' || value === null) {
            updates[field] = value;
          }
        }
      }
    }
    
    // Check if there are any valid updates
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided for update' },
        { status: 400 }
      );
    }
    
    // Use service role client to update the staff record
    const serviceClient = getServiceRoleClient();

    if (typeof updates.profile_image_file_id === 'string') {
      const { data: imageFile, error: imageFileError } = await serviceClient
        .from('files')
        .select('id, bucket, mimetype')
        .eq('id', updates.profile_image_file_id)
        .eq('bucket', 'staff-profile-images')
        .like('mimetype', 'image/%')
        .maybeSingle();

      if (imageFileError || !imageFile) {
        return NextResponse.json(
          { error: 'Invalid profile image file' },
          { status: 400 }
        );
      }
    }
    
    const { data, error } = await serviceClient
      .from('staff')
      .update(updates)
      .eq('id', tutorId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating profile:', error);
      captureApiError(error, "/api/profile");
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone_number,
        birthday: data.birthday,
        role: data.role,
        status: data.status,
        profile_bio: data.profile_bio,
        profile_image_file_id: data.profile_image_file_id,
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
    captureApiError(error, "/api/profile");
    console.error('Error in PATCH /api/profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/profile
 * Get tutor's own profile (alternative to using vtutor_profile view directly)
 */
export async function GET() {
  try {
    // Get the authenticated user's supabase client
    const userClient = createClient();
    
    // Verify user is a tutor
    const { data: isTutor, error: tutorCheckError } = await userClient.rpc('is_tutor');
    
    if (tutorCheckError) {
      console.error('Error checking tutor status:', tutorCheckError);
      captureApiError(tutorCheckError, "/api/profile");
      return NextResponse.json(
        { error: 'Failed to verify tutor status' },
        { status: 500 }
      );
    }
    
    if (!isTutor) {
      return NextResponse.json(
        { error: 'Unauthorized: User is not a tutor' },
        { status: 403 }
      );
    }
    
    // Query vtutor_profile view
    const { data, error } = await userClient
      .from('vtutor_profile')
      .select('*')
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching profile:', error);
      captureApiError(error, "/api/profile");
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
    captureApiError(error, "/api/profile");
    console.error('Error in GET /api/profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
