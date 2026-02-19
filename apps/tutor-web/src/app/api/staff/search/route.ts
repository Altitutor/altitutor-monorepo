import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import type { Tables } from '@altitutor/shared';

/**
 * GET /api/staff/search
 * Search for staff members (for adding to sessions)
 * 
 * Authorization:
 * - User must be an active tutor
 * - Returns ACTIVE and TRIAL staff only
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    
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
    
    // Use service role client to search staff (bypasses RLS)
    const serviceClient = getServiceRoleClient();
    
    let query = serviceClient
      .from('staff')
      .select('id, first_name, last_name, role, status, email, phone_number')
      .in('status', ['ACTIVE', 'TRIAL'])
      .order('first_name', { ascending: true })
      .limit(limit);
    
    // Apply search filter if provided
    const trimmed = search.trim();
    if (trimmed.length > 0) {
      const q = `%${trimmed}%`;
      query = query.or(`first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q}`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error searching staff:', error);
      return NextResponse.json(
        { error: 'Failed to search staff' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ staff: (data ?? []) as Tables<'staff'>[] });
  } catch (error) {
    console.error('Unexpected error in GET /api/staff/search:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
