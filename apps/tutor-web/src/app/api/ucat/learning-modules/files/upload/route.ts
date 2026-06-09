import { NextRequest, NextResponse } from 'next/server'
import type { TablesInsert } from '@altitutor/shared'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import { createClient } from '@/shared/lib/supabase/server-ssr'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'

const BUCKET = 'session-files'

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const moduleId = formData.get('moduleId')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }
    if (typeof moduleId !== 'string' || !moduleId.trim()) {
      return NextResponse.json({ error: 'Missing moduleId' }, { status: 400 })
    }

    const userClient = createClient()
    const { data: tutorId, error: tutorIdError } = await userClient.rpc('current_tutor_id')
    if (tutorIdError || !tutorId) {
      return NextResponse.json({ error: 'Failed to resolve tutor' }, { status: 500 })
    }

    const service = getServiceRoleClient()
    const timestamp = Date.now()
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `learning-modules/${moduleId}/${timestamp}_${sanitizedFilename}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { data: uploadData, error: uploadError } = await service.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      })

    if (uploadError || !uploadData) {
      return NextResponse.json(
        { error: uploadError?.message ?? 'Failed to upload file' },
        { status: 500 },
      )
    }

    const fileInsert: TablesInsert<'files'> = {
      mimetype: file.type || 'application/octet-stream',
      filename: file.name,
      size_bytes: file.size,
      metadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        source: 'ucat-learning-module',
        learningModuleId: moduleId,
      },
      storage_provider: 'supabase',
      bucket: BUCKET,
      storage_path: uploadData.path,
      created_by: tutorId,
    }

    const { data: fileRow, error: fileError } = await service
      .from('files')
      .insert(fileInsert)
      .select('id, filename')
      .single()

    if (fileError || !fileRow) {
      await service.storage.from(BUCKET).remove([uploadData.path])
      return NextResponse.json(
        { error: fileError?.message ?? 'Failed to create file record' },
        { status: 500 },
      )
    }

    const { data: signed, error: signedError } = await service.storage
      .from(BUCKET)
      .createSignedUrl(uploadData.path, 3600)

    if (signedError) {
      return NextResponse.json({ error: signedError.message }, { status: 500 })
    }

    return NextResponse.json({
      fileId: fileRow.id,
      filename: fileRow.filename,
      signedUrl: signed.signedUrl,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 },
    )
  }
}
