import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import type { Tables } from '@altitutor/shared';

export const dynamic = 'force-dynamic';

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
      captureApiError(tutorCheckError, "/api/staff/search");
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
    
    const createStaffQuery = () => serviceClient
      .from('staff')
      .select('id, first_name, last_name, role, status, email, phone_number')
      .in('status', ['ACTIVE', 'TRIAL'])
      .order('first_name', { ascending: true })
      .limit(limit);
    
    // Apply search filter if provided
    const trimmed = search.trim();
    if (trimmed.length > 0) {
      const q = `%${trimmed}%`;
      const results = await Promise.all(
        (['first_name', 'last_name', 'email'] as const).map((column) =>
          createStaffQuery().ilike(column, q)
        )
      );
      const failedResult = results.find((result) => result.error);

      if (failedResult?.error) {
        console.error('Error searching staff:', failedResult.error);
        captureApiError(failedResult.error, "/api/staff/search");
        return NextResponse.json(
          { error: 'Failed to search staff' },
          { status: 500 }
        );
      }

      const staffById = new Map(
        results
          .flatMap((result) => result.data ?? [])
          .map((staff) => [staff.id, staff] as const)
      );
      const staff = [...staffById.values()]
        .sort((left, right) =>
          (left.first_name ?? '').localeCompare(right.first_name ?? '')
          || (left.last_name ?? '').localeCompare(right.last_name ?? '')
        )
        .slice(0, limit);

      return NextResponse.json({ staff });
    }

    const { data, error } = await createStaffQuery();

    if (error) {
      console.error('Error searching staff:', error);
      captureApiError(error, "/api/staff/search");
      return NextResponse.json(
        { error: 'Failed to search staff' },
        { status: 500 }
      );
    }

    return NextResponse.json({ staff: (data ?? []) as Tables<'staff'>[] });
  } catch (error) {
    captureApiError(error, "/api/staff/search");
    console.error('Unexpected error in GET /api/staff/search:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
