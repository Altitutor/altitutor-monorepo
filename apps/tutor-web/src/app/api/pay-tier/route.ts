import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { fetchPayTierProgressForStaff } from '@/features/pay-tier/server/fetchPayTierProgress';

export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: isTutor, error: tutorCheckError } = await supabase.rpc('is_tutor');
    if (tutorCheckError || !isTutor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: tutorId, error: tutorIdError } = await supabase.rpc('current_tutor_id');
    if (tutorIdError || !tutorId) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    const progress = await fetchPayTierProgressForStaff(
      supabase as unknown as SupabaseClient<Database>,
      tutorId
    );
    return NextResponse.json({ progress });
  } catch (e) {
    console.error('GET /api/pay-tier:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load pay tier' },
      { status: 500 }
    );
  }
}
