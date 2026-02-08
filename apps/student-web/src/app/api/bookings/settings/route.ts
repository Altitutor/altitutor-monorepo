import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { createClient as createServerClient } from '@/shared/lib/supabase/server-ssr';

// Mark route as dynamic since it uses searchParams and auth
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const settingKey = searchParams.get('key');

    if (!settingKey) {
      return NextResponse.json(
        { error: 'Setting key is required' },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const userClient = createServerClient();
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Use service role to bypass RLS for reading booking settings
    // (booking_settings is read-only configuration that students need to access)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabase
      .from('booking_settings')
      .select('setting_value')
      .eq('setting_key', settingKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return NextResponse.json({ setting_value: null });
      }
      throw error;
    }

    return NextResponse.json({ setting_value: data?.setting_value ?? null });
  } catch (error) {
    console.error('Error fetching booking setting:', error);
    return NextResponse.json(
      { error: 'Failed to fetch booking setting' },
      { status: 500 }
    );
  }
}
