import { NextRequest, NextResponse } from 'next/server';
import {
  captureApiError,
  captureApiErrorResponse,
} from '@/lib/sentry/capture-api-error';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';

const BUCKET = 'flashcard-images';
const REFRESHED_URL_EXPIRY_SECONDS = 3600;
const VALID_PATH = /^[a-zA-Z0-9/_.-]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function topicIdFromPath(path: string): string | null {
  return path.split('/')[0] || null;
}

export async function POST(request: NextRequest) {
  let body: { paths?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const paths = Array.isArray(body.paths)
    ? body.paths.filter(
        (path): path is string => typeof path === 'string' && path.length > 0,
      )
    : [];
  if (paths.length === 0 || paths.length > 50) {
    return NextResponse.json(
      {
        error:
          paths.length === 0
            ? 'paths must be a non-empty array'
            : 'Too many image references (max 50)',
      },
      { status: 400 },
    );
  }

  for (const path of paths) {
    const topicId = topicIdFromPath(path);
    if (
      !VALID_PATH.test(path) ||
      path.includes('..') ||
      !topicId ||
      !UUID_PATTERN.test(topicId)
    ) {
      return NextResponse.json(
        { error: `Invalid path: ${path.slice(0, 80)}` },
        { status: 400 },
      );
    }
  }

  const userClient = createClient();
  const { data: isAdmin, error: authError } = await userClient.rpc(
    'is_adminstaff_active',
  );
  if (authError) {
    return captureApiErrorResponse(
      authError,
      '/api/flashcards/images/signed-urls',
      NextResponse.json({ error: authError.message }, { status: 500 }),
    );
  }
  if (!isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const adminClient = getServerSupabaseAdmin();
  const topicIds = [
    ...new Set(
      paths.map(topicIdFromPath).filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: topics, error: topicError } = await adminClient
    .from('topics')
    .select('id')
    .in('id', topicIds);
  if (topicError) {
    return captureApiErrorResponse(
      topicError,
      '/api/flashcards/images/signed-urls',
      NextResponse.json({ error: topicError.message }, { status: 500 }),
    );
  }
  if ((topics ?? []).length !== topicIds.length) {
    return NextResponse.json(
      { error: 'Flashcard image is not accessible' },
      { status: 403 },
    );
  }

  const { data, error } = await adminClient.storage
    .from(BUCKET)
    .createSignedUrls(paths, REFRESHED_URL_EXPIRY_SECONDS);
  if (error) {
    captureApiError(error, '/api/flashcards/images/signed-urls');
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const failed = data.find((item) => item.error || !item.signedUrl);
  if (failed) {
    return NextResponse.json(
      { error: failed.error ?? 'No signed URL returned', path: failed.path },
      { status: failed.error === 'Object not found' ? 404 : 500 },
    );
  }

  return NextResponse.json({
    data: { signedUrls: data.map((item) => item.signedUrl) },
  });
}
