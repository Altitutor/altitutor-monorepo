import { captureApiError, captureApiErrorResponse } from '@/lib/sentry/capture-api-error';
import { NextResponse } from 'next/server';
import {
  IMAGE_OCCLUSION_MAX_FILE_BYTES,
  IMAGE_OCCLUSION_MAX_PIXELS,
  inspectRasterImage,
  type TablesInsert,
} from '@altitutor/shared';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServerSupabaseAdmin } from '@/shared/lib/supabase/server';

const BUCKET = 'flashcard-images';
const SIGNED_URL_EXPIRY_SECONDS = 3600;

function buildStoragePath(topicId: string, file: File): string {
  const timestamp = Date.now();
  const uuid = crypto.randomUUID().slice(0, 8);
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${topicId}/${timestamp}_${uuid}_${sanitizedFilename}`;
}

export async function POST(request: Request) {
  const userClient = createClient();
  const { data: isAdmin } = await userClient.rpc('is_adminstaff_active');
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const formData = await request.formData();
  const topicId = formData.get('topicId');
  const file = formData.get('file');
  if (typeof topicId !== 'string' || !topicId) {
    return NextResponse.json({ error: 'topicId is required' }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
  }
  if (file.size > IMAGE_OCCLUSION_MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'Image must be 10 MB or smaller' }, { status: 400 });
  }
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const image = inspectRasterImage(fileBytes);
  if (!image) return NextResponse.json({ error: 'Only valid PNG, JPEG, and WebP images are supported' }, { status: 400 });
  if (image.width * image.height > IMAGE_OCCLUSION_MAX_PIXELS) {
    return NextResponse.json({ error: 'Image must be 25 megapixels or smaller' }, { status: 400 });
  }

  const adminClient = getServerSupabaseAdmin();
  const { data: topic } = await adminClient.from('topics').select('id').eq('id', topicId).maybeSingle();
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

  const {
    data: { user },
  } = await userClient.auth.getUser();
  const { data: staff } = user?.id
    ? await adminClient.from('staff').select('id').eq('user_id', user.id).limit(1).maybeSingle()
    : { data: null };

  const storagePath = buildStoragePath(topicId, file);
  const { data: uploadData, error: uploadError } = await adminClient.storage
    .from(BUCKET)
    .upload(storagePath, fileBytes, {
      cacheControl: '3600',
      upsert: false,
      contentType: image.mimetype,
    });

  if (uploadError) return captureApiErrorResponse(uploadError, "/api/flashcards/images/upload", NextResponse.json({ error: uploadError.message }, { status: 500 }));

  const fileInsert: TablesInsert<'files'> = {
    mimetype: image.mimetype,
    filename: file.name,
    size_bytes: file.size,
    metadata: {
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
      source: BUCKET,
      topicId,
    },
    storage_provider: 'supabase',
    bucket: BUCKET,
    storage_path: uploadData.path,
    created_by: staff?.id ?? null,
  };

  const { data: fileRow, error: fileError } = await adminClient
    .from('files')
    .insert(fileInsert)
    .select('id')
    .single();

  if (fileError || !fileRow) {
    await adminClient.storage.from(BUCKET).remove([uploadData.path]);
    captureApiError(fileError, "/api/flashcards/images/upload");
    return NextResponse.json({ error: fileError?.message ?? 'Failed to create file row' }, { status: 500 });
  }

  const { data: signed, error: signedError } = await adminClient.storage
    .from(BUCKET)
    .createSignedUrl(uploadData.path, SIGNED_URL_EXPIRY_SECONDS);

  if (signedError || !signed?.signedUrl) {
    captureApiError(signedError, "/api/flashcards/images/upload");
    return NextResponse.json({ error: signedError?.message ?? 'Failed to create signed URL' }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      fileId: fileRow.id,
      storagePath: uploadData.path,
      signedUrl: signed.signedUrl,
      naturalWidth: image.width,
      naturalHeight: image.height,
      mimetype: image.mimetype,
    },
  });
}

export async function DELETE(request: Request) {
  const userClient = createClient();
  const { data: isAdmin } = await userClient.rpc('is_adminstaff_active');
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const fileId = new URL(request.url).searchParams.get('fileId');
  if (!fileId) return NextResponse.json({ error: 'fileId is required' }, { status: 400 });

  const adminClient = getServerSupabaseAdmin();
  const [{ data: file }, { data: reference }] = await Promise.all([
    adminClient.from('files').select('id,bucket,storage_path').eq('id', fileId).maybeSingle(),
    adminClient.from('flashcards').select('id').eq('image_file_id', fileId).limit(1).maybeSingle(),
  ]);
  if (!file || file.bucket !== BUCKET || !file.storage_path) return NextResponse.json({ data: { deleted: false } });
  if (reference) return NextResponse.json({ error: 'Image is still referenced by a flashcard' }, { status: 409 });

  const { error: storageError } = await adminClient.storage.from(BUCKET).remove([file.storage_path]);
  if (storageError) return captureApiErrorResponse(storageError, '/api/flashcards/images/upload', NextResponse.json({ error: storageError.message }, { status: 500 }));
  const { error: fileError } = await adminClient.from('files').delete().eq('id', fileId);
  if (fileError) return captureApiErrorResponse(fileError, '/api/flashcards/images/upload', NextResponse.json({ error: fileError.message }, { status: 500 }));
  return NextResponse.json({ data: { deleted: true } });
}
