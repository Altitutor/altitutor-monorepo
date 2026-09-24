import { NextRequest, NextResponse } from 'next/server'
import type { TablesInsert } from '@altitutor/shared'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import { createClient } from '@/shared/lib/supabase/server-ssr'
import { captureApiError } from '@/lib/sentry/capture-api-error'

const BUCKET = 'ucat-images'

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const form = await request.formData()
    const file = form.get('file')
    const stemId = form.get('stemId')
    if (!(file instanceof File) || !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'A valid image is required' }, { status: 400 })
    }

    const { data: tutorId, error: tutorError } = await createClient().rpc('current_tutor_id')
    if (tutorError || !tutorId) {
      return NextResponse.json({ error: 'Failed to resolve tutor' }, { status: 500 })
    }

    const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const prefix = typeof stemId === 'string' && stemId ? stemId : `temp/${tutorId}`
    const storagePath = `${prefix}/${Date.now()}_${sanitized}`
    const service = getServiceRoleClient()
    const { data: uploaded, error: uploadError } = await service.storage
      .from(BUCKET)
      .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })
    if (uploadError || !uploaded) throw uploadError ?? new Error('Upload failed')

    const insert: TablesInsert<'files'> = {
      mimetype: file.type,
      filename: file.name,
      size_bytes: file.size,
      metadata: { originalName: file.name, uploadedAt: new Date().toISOString(), source: BUCKET },
      storage_provider: 'supabase',
      bucket: BUCKET,
      storage_path: uploaded.path,
      created_by: tutorId,
    }
    const { data: fileRow, error: fileError } = await service
      .from('files')
      .insert(insert)
      .select('id')
      .single()
    if (fileError || !fileRow) {
      await service.storage.from(BUCKET).remove([uploaded.path])
      throw fileError ?? new Error('Failed to create file record')
    }

    const { data: signed, error: signedError } = await service.storage
      .from(BUCKET)
      .createSignedUrl(uploaded.path, 3600)
    if (signedError || !signed) throw signedError ?? new Error('Failed to sign image')

    return NextResponse.json({ fileId: fileRow.id, storagePath: uploaded.path, signedUrl: signed.signedUrl })
  } catch (error) {
    captureApiError(error, '/api/ucat/images')
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const fileIds = Array.isArray(body.fileIds)
      ? body.fileIds.filter((id: unknown): id is string => typeof id === 'string')
      : []
    if (fileIds.length === 0) return new NextResponse(null, { status: 204 })

    const service = getServiceRoleClient()
    const { data: files, error } = await service
      .from('files')
      .select('id, storage_path')
      .eq('bucket', BUCKET)
      .in('id', fileIds)
    if (error) throw error

    const paths = (files ?? []).flatMap((file) => file.storage_path ? [file.storage_path] : [])
    if (paths.length > 0) await service.storage.from(BUCKET).remove(paths)
    if (files?.length) {
      const { error: deleteError } = await service.from('files').delete().in('id', files.map((file) => file.id))
      if (deleteError) throw deleteError
    }
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    captureApiError(error, '/api/ucat/images')
    return NextResponse.json({ error: 'Failed to delete images' }, { status: 500 })
  }
}
