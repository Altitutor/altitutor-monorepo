import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';

/** Path must look like admin-rich-text-images storage path: context/timestamp_uuid_filename, no traversal. */
const VALID_PATH = /^[a-zA-Z0-9/_.-]+$/;

const REFRESHED_URL_EXPIRY_SECONDS = 86400;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = getServerSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  let body: { paths?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const paths = body.paths;
  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json(
      { error: 'paths must be a non-empty array' },
      { status: 400 }
    );
  }

  if (paths.length > 50) {
    return NextResponse.json(
      { error: 'Too many paths (max 50)' },
      { status: 400 }
    );
  }

  for (const p of paths) {
    if (typeof p !== 'string' || !VALID_PATH.test(p) || p.includes('..')) {
      return NextResponse.json(
        { error: `Invalid path: ${String(p).slice(0, 80)}` },
        { status: 400 }
      );
    }
  }

  const signedUrls: string[] = [];
  for (const path of paths) {
    const { data, error } = await supabaseAdmin.storage
      .from('admin-rich-text-images')
      .createSignedUrl(path, REFRESHED_URL_EXPIRY_SECONDS);

    if (error) {
      return NextResponse.json(
        { error: error.message, path },
        { status: error.message === 'Object not found' ? 404 : 500 }
      );
    }

    if (!data?.signedUrl) {
      return NextResponse.json(
        { error: 'No signed URL returned', path },
        { status: 500 }
      );
    }

    signedUrls.push(data.signedUrl);
  }

  return NextResponse.json({ signedUrls });
}
