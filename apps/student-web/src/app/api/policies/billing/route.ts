import { NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Public API to fetch billing policy content for display during registration.
 * Uses service role to bypass RLS (unauthenticated users need to read this).
 */
export async function GET() {
  try {
    const supabase = getServerSupabaseAdmin();
    // Type assertion: policies table exists after migration (generated types may lag)
    const policiesClient = supabase as unknown as {
      from: (t: string) => { select: (c: string) => { eq: (a: string, b: string) => { maybeSingle: () => Promise<{ data: { content?: unknown } | null; error: unknown }> } } };
    };
    const { data, error } = await policiesClient
      .from('policies')
      .select('content')
      .eq('key', 'billing_policy')
      .maybeSingle();

    if (error) {
      console.error('[policies/billing] Error fetching policy:', error);
      return NextResponse.json(
        { error: 'Failed to load billing policy' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      content: data?.content ?? null,
    });
  } catch (err) {
    console.error('[policies/billing] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Failed to load billing policy' },
      { status: 500 }
    );
  }
}
