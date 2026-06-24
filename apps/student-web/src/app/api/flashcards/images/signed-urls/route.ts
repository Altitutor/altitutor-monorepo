import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';

const BUCKET = 'flashcard-images';
const REFRESHED_URL_EXPIRY_SECONDS = 3600;
const VALID_PATH = /^[a-zA-Z0-9/_.-]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function topicIdFromPath(path: string): string | null {
  const [topicId] = path.split('/');
  return topicId || null;
}

export async function POST(request: NextRequest) {
  let body: { paths?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const paths = Array.isArray(body.paths)
    ? body.paths.filter((path): path is string => typeof path === 'string' && path.length > 0)
    : [];

  if (paths.length === 0) {
    return NextResponse.json({ error: 'paths must be a non-empty array' }, { status: 400 });
  }

  if (paths.length > 50) {
    return NextResponse.json({ error: 'Too many image references (max 50)' }, { status: 400 });
  }

  for (const path of paths) {
    const topicId = topicIdFromPath(path);
    if (!VALID_PATH.test(path) || path.includes('..') || !topicId || !UUID_PATTERN.test(topicId)) {
      return NextResponse.json({ error: `Invalid path: ${path.slice(0, 80)}` }, { status: 400 });
    }
  }

  const topicIds = [...new Set(paths.map(topicIdFromPath).filter((id): id is string => Boolean(id)))];
  const userClient = createClient();
  const { data: accessibleTopics, error: topicError } = await userClient
    .from('vstudent_topics')
    .select('id')
    .in('id', topicIds);

  if (topicError) return NextResponse.json({ error: topicError.message }, { status: 500 });

  const accessibleTopicIds = new Set(
    ((accessibleTopics ?? []) as unknown as Array<{ id: string | null }>)
      .map((topic) => topic.id)
      .filter((id): id is string => Boolean(id)),
  );
  const inaccessiblePath = paths.find((path) => {
    const topicId = topicIdFromPath(path);
    return !topicId || !accessibleTopicIds.has(topicId);
  });

  if (inaccessiblePath) {
    return NextResponse.json({ error: 'flashcard_image_not_accessible', path: inaccessiblePath }, { status: 403 });
  }

  const adminClient = getServerSupabaseAdmin();
  const signedUrls: string[] = [];
  for (const path of paths) {
    const { data, error } = await adminClient.storage
      .from(BUCKET)
      .createSignedUrl(path, REFRESHED_URL_EXPIRY_SECONDS);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message ?? 'No signed URL returned', path },
        { status: error?.message === 'Object not found' ? 404 : 500 },
      );
    }
    signedUrls.push(data.signedUrl);
  }

  return NextResponse.json({ data: { signedUrls } });
}
