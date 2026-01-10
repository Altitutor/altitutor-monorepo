import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin';
import { createClient } from '@/shared/lib/supabase/server-ssr';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// Whitelist of fields that admin staff are allowed to update
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
 * Update admin staff's own profile
 * 
 * Authorization:
 * - User must be an active admin staff member
 * - Can only update whitelisted fields
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get the authenticated user's supabase client
    const userClient = createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get current staff record
    const { data: staffRecord, error: staffError } = await userClient
      .from('staff')
      .select('id, role, status')
      .eq('user_id', user.id)
      .maybeSingle<{ id: string; role: string; status: string }>();
    
    if (staffError) {
      console.error('Error fetching staff record:', staffError);
      return NextResponse.json(
        { error: 'Failed to verify staff status' },
        { status: 500 }
      );
    }
    
    if (!staffRecord) {
      return NextResponse.json(
        { error: 'Staff record not found' },
        { status: 404 }
      );
    }
    
    // Verify user is admin staff
    if (staffRecord.role !== 'ADMINSTAFF') {
      return NextResponse.json(
        { error: 'Unauthorized: Only admin staff can update profile' },
        { status: 403 }
      );
    }
    
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration error' },
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
    
    // Use admin client to update the staff record
    const { data, error } = await supabaseAdmin
      .from('staff')
      .update(updates)
      .eq('id', staffRecord.id)
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
      data,
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

