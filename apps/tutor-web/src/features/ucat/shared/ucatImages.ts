import type { Tables, TablesInsert } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@altitutor/shared'
import { getSupabaseClient } from '@/shared/lib/supabase/client'

type FilesRow = Tables<'files'>

export interface UploadUcatImageParams {
  file: File
  stemId?: string | null
}

export interface UploadUcatImageResult {
  fileId: string
  storagePath: string
  signedUrl: string
}

function getSupabase(): SupabaseClient<Database> {
  return getSupabaseClient() as SupabaseClient<Database>
}

function buildStoragePath(stemId: string | null | undefined, userId: string, file: File): string {
  const timestamp = Date.now()
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')

  if (stemId) {
    return `${stemId}/${timestamp}_${sanitizedFilename}`
  }

  return `temp/${userId}/${timestamp}_${sanitizedFilename}`
}

export async function uploadUcatImage(params: UploadUcatImageParams): Promise<UploadUcatImageResult> {
  const supabase = getSupabase()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    throw userError
  }

  if (!user) {
    throw new Error('User not authenticated')
  }

  const storagePath = buildStoragePath(params.stemId ?? null, user.id, params.file)

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('ucat-images')
    .upload(storagePath, params.file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    console.error('Failed to upload UCAT image:', uploadError)
    throw uploadError
  }

  // Resolve staff id for created_by where possible
  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (staffError) {
    console.error('Failed to resolve staff id for UCAT image:', staffError)
  }

  const createdBy = staff?.id ?? null

  const fileInsert: TablesInsert<'files'> = {
    mimetype: params.file.type,
    filename: params.file.name,
    size_bytes: params.file.size,
    metadata: {
      originalName: params.file.name,
      uploadedAt: new Date().toISOString(),
      source: 'ucat-images',
    },
    storage_provider: 'supabase',
    bucket: 'ucat-images',
    storage_path: uploadData.path,
    created_by: createdBy,
  }

  const { data: fileRow, error: fileError } = await supabase
    .from('files')
    .insert(fileInsert)
    .select('*')
    .single<FilesRow>()

  if (fileError || !fileRow) {
    console.error('Failed to create files row for UCAT image:', fileError)

    // Attempt best-effort cleanup of storage object
    try {
      await supabase.storage.from('ucat-images').remove([uploadData.path])
    } catch (cleanupError) {
      console.error('Failed to cleanup UCAT image from storage after DB error:', cleanupError)
    }

    throw fileError ?? new Error('Failed to create files row for UCAT image')
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from('ucat-images')
    .createSignedUrl(uploadData.path, 3600)

  if (signedError || !signed) {
    console.error('Failed to create signed URL for UCAT image:', signedError)
    throw signedError ?? new Error('Failed to create signed URL for UCAT image')
  }

  return {
    fileId: fileRow.id,
    storagePath: uploadData.path,
    signedUrl: signed.signedUrl,
  }
}

export async function deleteUcatImagesByFileIds(fileIds: string[]): Promise<void> {
  if (fileIds.length === 0) return

  const supabase = getSupabase()

  const { data: files, error } = await supabase
    .from('files')
    .select('id, storage_path, bucket')
    .in('id', fileIds)

  if (error) {
    console.error('Failed to fetch UCAT image files for deletion:', error)
    throw error
  }

  const ucatFiles = (files ?? []).filter((f) => f.bucket === 'ucat-images')
  const paths = ucatFiles
    .map((f) => f.storage_path)
    .filter((p): p is string => typeof p === 'string' && p.length > 0)

  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from('ucat-images').remove(paths)
    if (storageError) {
      console.error('Failed to delete UCAT images from storage:', storageError)
      // continue with DB deletion even if storage deletion fails
    }
  }

  const { error: deleteError } = await supabase.from('files').delete().in('id', fileIds)
  if (deleteError) {
    console.error('Failed to delete UCAT image file rows:', deleteError)
    throw deleteError
  }
}

