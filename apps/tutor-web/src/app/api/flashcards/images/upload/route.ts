import { NextResponse } from 'next/server';
import type { TablesInsert } from '@altitutor/shared';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';

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
  const { data: isTutor } = await userClient.rpc('is_tutor');
  if (!isTutor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const formData = await request.formData();
  const topicId = formData.get('topicId');
  const file = formData.get('file');
  if (typeof topicId !== 'string' || !topicId) {
    return NextResponse.json({ error: 'topicId is required' }, { status: 400 });
  }
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
  }

  const { data: accessibleTopic } = await userClient
    .from('vtutor_topics')
    .select('id')
    .eq('id', topicId)
    .maybeSingle();
  if (!accessibleTopic) return NextResponse.json({ error: 'Topic not accessible' }, { status: 403 });

  const serviceClient = getServiceRoleClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  const { data: staff } = user?.id
    ? await serviceClient.from('staff').select('id').eq('user_id', user.id).limit(1).maybeSingle()
    : { data: null };

  const storagePath = buildStoragePath(topicId, file);
  const { data: uploadData, error: uploadError } = await serviceClient.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const fileInsert: TablesInsert<'files'> = {
    mimetype: file.type,
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

  const { data: fileRow, error: fileError } = await serviceClient
    .from('files')
    .insert(fileInsert)
    .select('id')
    .single();

  if (fileError || !fileRow) {
    await serviceClient.storage.from(BUCKET).remove([uploadData.path]);
    return NextResponse.json({ error: fileError?.message ?? 'Failed to create file row' }, { status: 500 });
  }

  const { data: signed, error: signedError } = await serviceClient.storage
    .from(BUCKET)
    .createSignedUrl(uploadData.path, SIGNED_URL_EXPIRY_SECONDS);

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: signedError?.message ?? 'Failed to create signed URL' }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      fileId: fileRow.id,
      storagePath: uploadData.path,
      signedUrl: signed.signedUrl,
    },
  });
}
