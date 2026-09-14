import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';

const BUCKET = 'admin-rich-text-images';
const VALID_PATH = /^[a-zA-Z0-9/_.-]+$/;
const REFRESHED_URL_EXPIRY_SECONDS = 86400;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    captureApiError(authError, '/api/admin/rich-text-images/signed-urls');
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: isAdmin, error: roleError } = await supabase.rpc(
    'is_adminstaff_active',
  );
  if (roleError) {
    captureApiError(roleError, '/api/admin/rich-text-images/signed-urls');
    return NextResponse.json({ error: roleError.message }, { status: 500 });
  }
  if (!isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabaseAdmin = getServerSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 },
    );
  }

  let body: { paths?: unknown; fileIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const requestedPaths = Array.isArray(body.paths) ? body.paths : [];
  const fileIds = Array.isArray(body.fileIds)
    ? body.fileIds.filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      )
    : [];
  if (requestedPaths.length === 0 && fileIds.length === 0) {
    return NextResponse.json(
      { error: 'paths or fileIds must be a non-empty array' },
      { status: 400 },
    );
  }
  if (requestedPaths.length + fileIds.length > 50) {
    return NextResponse.json(
      { error: 'Too many image references (max 50)' },
      { status: 400 },
    );
  }
  for (const path of requestedPaths) {
    if (
      typeof path !== 'string' ||
      !VALID_PATH.test(path) ||
      path.includes('..')
    ) {
      return NextResponse.json(
        { error: `Invalid path: ${String(path).slice(0, 80)}` },
        { status: 400 },
      );
    }
  }

  const paths = requestedPaths as string[];
  if (fileIds.length > 0) {
    const { data: files, error } = await supabaseAdmin
      .from('files')
      .select('id, bucket, storage_path')
      .in('id', fileIds);
    if (error) {
      captureApiError(error, '/api/admin/rich-text-images/signed-urls');
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const pathByFileId = new Map(
      (files ?? [])
        .filter(
          (file) =>
            file.bucket === BUCKET && typeof file.storage_path === 'string',
        )
        .map((file) => [file.id, file.storage_path as string]),
    );
    for (const fileId of fileIds) {
      const path = pathByFileId.get(fileId);
      if (!path) {
        return NextResponse.json(
          { error: 'Image file not found', fileId },
          { status: 404 },
        );
      }
      paths.push(path);
    }
  }

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrls(paths, REFRESHED_URL_EXPIRY_SECONDS);
  if (error) {
    captureApiError(error, '/api/admin/rich-text-images/signed-urls');
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const failed = data.find((item) => item.error || !item.signedUrl);
  if (failed) {
    return NextResponse.json(
      { error: failed.error ?? 'No signed URL returned', path: failed.path },
      { status: failed.error === 'Object not found' ? 404 : 500 },
    );
  }
  return NextResponse.json({ signedUrls: data.map((item) => item.signedUrl) });
}
