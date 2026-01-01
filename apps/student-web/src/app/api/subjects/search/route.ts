import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const yearLevels = searchParams.get('year_levels')?.split(',').map(Number).filter(Boolean);
    const curriculums = searchParams.get('curriculums')?.split(',').filter(Boolean);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Use service role client to call search_subjects_admin
    // This is a public endpoint for trial booking, so we use service role
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { data: rpcResult, error: rpcError } = await supabase.rpc('search_subjects_public', {
      p_search: search.trim() || undefined,
      p_year_levels: yearLevels && yearLevels.length > 0 ? yearLevels : undefined,
      p_curriculums: curriculums && curriculums.length > 0 ? curriculums : undefined,
      p_disciplines: undefined,
      p_levels: undefined,
      p_limit: limit,
      p_offset: offset,
      p_order_by: 'name',
      p_ascending: true,
    });

    if (rpcError) {
      console.error('Error searching subjects:', rpcError);
      return NextResponse.json(
        { error: 'Failed to search subjects' },
        { status: 500 }
      );
    }

    const rpcData = rpcResult as { subjects: any[]; total: number } | null;
    return NextResponse.json({
      subjects: rpcData?.subjects || [],
      total: rpcData?.total ?? 0,
    });
  } catch (error) {
    console.error('Error in GET /api/subjects/search:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
