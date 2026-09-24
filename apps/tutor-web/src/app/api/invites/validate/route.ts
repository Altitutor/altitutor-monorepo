import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Missing token parameter' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS (this is a public endpoint for invite validation)
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Check if token exists in staff table
    const { data: staffMember, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, first_name, last_name, email, phone_number, role, invite_token')
      .eq('invite_token', token)
      .maybeSingle();

    if (staffError) {
      // eslint-disable-next-line no-console
      console.error('[TUTOR INVITE VALIDATE] Error validating staff invite token:', staffError);
      captureApiError(staffError, "/api/invites/validate");
      return NextResponse.json(
        { error: 'Failed to validate token' },
        { status: 500 }
      );
    }

    if (staffMember) {
      const [{ data: subjects, error: subjectsError }, { data: staffSubjects, error: staffSubjectsError }] =
        await Promise.all([
          supabaseAdmin
            .from('subjects')
            .select('id, name, curriculum, year_level, level, short_name, long_name')
            .order('name'),
          supabaseAdmin
            .from('staff_subjects')
            .select('subject_id')
            .eq('staff_id', staffMember.id),
        ]);

      if (subjectsError || staffSubjectsError) {
        captureApiError(subjectsError ?? staffSubjectsError, '/api/invites/validate');
        return NextResponse.json(
          { error: 'Failed to load onboarding options' },
          { status: 500 },
        );
      }

      return NextResponse.json({
        valid: true,
        type: 'staff',
        data: {
          id: staffMember.id,
          first_name: staffMember.first_name,
          last_name: staffMember.last_name,
          email: staffMember.email,
          phone: staffMember.phone_number,
          role: staffMember.role,
          subject_ids: (staffSubjects ?? []).map(({ subject_id }) => subject_id),
          subjects: subjects ?? [],
        }
      }, { status: 200 });
    }

    // If not found in staff, token is invalid for this endpoint
    return NextResponse.json(
      { valid: false, error: 'Invalid or expired token' },
      { status: 404 }
    );
  } catch (error) {
    captureApiError(error, "/api/invites/validate");
    // eslint-disable-next-line no-console
    console.error('Unexpected error validating invite token:', error);
    return NextResponse.json(
      { error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
