import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import type { Database } from '@altitutor/shared';

// Whitelist of fields that tutors are allowed to update
const ALLOWED_UPDATE_FIELDS = [
  'phone_number',
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
        if (field === 'phone_number') {
          if (typeof value === 'string' || value === null) {
            updates[field] = value;
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
    
    const { data, error } = await serviceClient
      .from('staff')
      .update(updates)
      .eq('id', tutorId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating profile:', error);
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
        role: data.role,
        status: data.status,
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

