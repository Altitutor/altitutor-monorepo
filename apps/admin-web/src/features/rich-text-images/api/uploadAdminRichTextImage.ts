import type { TablesInsert } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

export type AdminRichTextImageContext =
  | 'notes'
  | 'notes_documents'
  | 'projects'
  | 'issues'
  | 'tasks';

export interface UploadAdminRichTextImageParams {
  file: File;
  context: AdminRichTextImageContext;
}

export interface UploadAdminRichTextImageResult {
  fileId: string;
  storagePath: string;
  signedUrl: string;
}

const BUCKET = 'admin-rich-text-images';
const SIGNED_URL_EXPIRY_SECONDS = 3600;

function buildStoragePath(context: AdminRichTextImageContext, file: File): string {
  const timestamp = Date.now();
  const uuid = crypto.randomUUID().slice(0, 8);
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${context}/${timestamp}_${uuid}_${sanitizedFilename}`;
}

export async function uploadAdminRichTextImage(
  params: UploadAdminRichTextImageParams
): Promise<UploadAdminRichTextImageResult> {
  const supabase = getSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error('User not authenticated');
  }

  const storagePath = buildStoragePath(params.context, params.file);

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, params.file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error('Failed to upload admin rich text image:', uploadError);
    throw uploadError;
  }

  const { data: staff } = await supabase
    .from('staff')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const createdBy = staff?.id ?? null;

  const fileInsert: TablesInsert<'files'> = {
    mimetype: params.file.type,
    filename: params.file.name,
    size_bytes: params.file.size,
    metadata: {
      originalName: params.file.name,
      uploadedAt: new Date().toISOString(),
      source: 'admin-rich-text-images',
      context: params.context,
    },
    storage_provider: 'supabase',
    bucket: BUCKET,
    storage_path: uploadData.path,
    created_by: createdBy,
  };

  const { data: fileRow, error: fileError } = await supabase
    .from('files')
    .insert(fileInsert)
    .select('*')
    .single();

  if (fileError || !fileRow) {
    console.error('Failed to create files row for admin rich text image:', fileError);
    try {
      await supabase.storage.from(BUCKET).remove([uploadData.path]);
    } catch (cleanupError) {
      console.error('Failed to cleanup image from storage after DB error:', cleanupError);
    }
    throw fileError ?? new Error('Failed to create files row for admin rich text image');
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(uploadData.path, SIGNED_URL_EXPIRY_SECONDS);

  if (signedError || !signed) {
    console.error('Failed to create signed URL for admin rich text image:', signedError);
    throw signedError ?? new Error('Failed to create signed URL for admin rich text image');
  }

  return {
    fileId: fileRow.id,
    storagePath: uploadData.path,
    signedUrl: signed.signedUrl,
  };
}
