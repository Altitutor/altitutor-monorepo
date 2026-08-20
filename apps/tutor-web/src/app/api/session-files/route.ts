import { NextRequest, NextResponse } from 'next/server'
import type { TablesInsert } from '@altitutor/shared'
import { createClient } from '@/shared/lib/supabase/server-ssr'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import { captureApiError } from '@/lib/sentry/capture-api-error'

const BUCKET = 'session-files'

async function tutorContext() {
  const userClient = createClient()
  const [{ data: isTutor }, { data: tutorId }] = await Promise.all([
    userClient.rpc('is_tutor'),
    userClient.rpc('current_tutor_id'),
  ])
  return isTutor && tutorId ? { tutorId } : null
}

async function canAccessSession(tutorId: string, sessionId: string) {
  const { data, error } = await getServiceRoleClient()
    .from('sessions_staff')
    .select('session_id')
    .eq('session_id', sessionId)
    .eq('staff_id', tutorId)
    .maybeSingle()
  return !error && Boolean(data)
}

export async function GET(request: NextRequest) {
  try {
    const tutor = await tutorContext()
    if (!tutor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const sessionId = request.nextUrl.searchParams.get('sessionId')
    if (!sessionId || !(await canAccessSession(tutor.tutorId, sessionId))) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const service = getServiceRoleClient()
    const { data, error } = await service
      .from('sessions_files')
      .select('*, file:files(*)')
      .eq('session_id', sessionId)
      .order('display_order', { ascending: true })
    if (error) throw error

    const storagePaths = (data ?? []).flatMap((row) => (
      row.file?.storage_path ? [row.file.storage_path] : []
    ))
    const { data: signedUrls } = storagePaths.length > 0
      ? await service.storage.from(BUCKET).createSignedUrls(storagePaths, 3600)
      : { data: [] }
    const signedUrlByPath = new Map(
      (signedUrls ?? []).flatMap((signed) => (
        signed.path ? [[signed.path, signed.signedUrl] as const] : []
      )),
    )
    const rows = (data ?? []).map((row) => ({
      ...row,
      signedUrl: row.file?.storage_path
        ? signedUrlByPath.get(row.file.storage_path) ?? null
        : null,
    }))
    return NextResponse.json(rows)
  } catch (error) {
    captureApiError(error, '/api/session-files')
    return NextResponse.json({ error: 'Failed to load session files' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const tutor = await tutorContext()
    if (!tutor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const form = await request.formData()
    const file = form.get('file')
    const sessionId = form.get('sessionId')
    const displayOrder = Number(form.get('displayOrder') ?? '0')
    if (!(file instanceof File) || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Invalid upload' }, { status: 400 })
    }
    if (!(await canAccessSession(tutor.tutorId, sessionId))) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const service = getServiceRoleClient()
    const path = `${sessionId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const { data: uploaded, error: uploadError } = await service.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
      })
    if (uploadError || !uploaded) throw uploadError ?? new Error('Upload failed')

    const fileInsert: TablesInsert<'files'> = {
      mimetype: file.type || 'application/octet-stream',
      filename: file.name,
      size_bytes: file.size,
      metadata: { originalName: file.name, uploadedAt: new Date().toISOString() },
      storage_provider: 'supabase',
      bucket: BUCKET,
      storage_path: uploaded.path,
      created_by: tutor.tutorId,
    }
    const { data: fileRow, error: fileError } = await service.from('files').insert(fileInsert).select('id').single()
    if (fileError || !fileRow) {
      await service.storage.from(BUCKET).remove([uploaded.path])
      throw fileError ?? new Error('Failed to create file')
    }

    const { data: link, error: linkError } = await service
      .from('sessions_files')
      .insert({ session_id: sessionId, file_id: fileRow.id, display_order: displayOrder, created_by: tutor.tutorId })
      .select('*')
      .single()
    if (linkError || !link) {
      await service.from('files').delete().eq('id', fileRow.id)
      await service.storage.from(BUCKET).remove([uploaded.path])
      throw linkError ?? new Error('Failed to link file')
    }
    return NextResponse.json(link, { status: 201 })
  } catch (error) {
    captureApiError(error, '/api/session-files')
    return NextResponse.json({ error: 'Failed to upload session file' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const tutor = await tutorContext()
    if (!tutor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const fileId = request.nextUrl.searchParams.get('fileId')
    if (!fileId) return NextResponse.json({ error: 'fileId is required' }, { status: 400 })
    const service = getServiceRoleClient()
    const { data: link } = await service
      .from('sessions_files')
      .select('id, session_id, file:files(storage_path)')
      .eq('file_id', fileId)
      .maybeSingle()
    if (!link || !(await canAccessSession(tutor.tutorId, link.session_id))) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    const storagePath = link.file?.storage_path
    const { error } = await service.from('sessions_files').delete().eq('id', link.id)
    if (error) throw error
    await service.from('files').delete().eq('id', fileId)
    if (storagePath) await service.storage.from(BUCKET).remove([storagePath])
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    captureApiError(error, '/api/session-files')
    return NextResponse.json({ error: 'Failed to delete session file' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const tutor = await tutorContext()
    if (!tutor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { sessionFileId, displayOrder } = await request.json()
    const service = getServiceRoleClient()
    const { data: link } = await service.from('sessions_files').select('session_id').eq('id', sessionFileId).maybeSingle()
    if (!link || !(await canAccessSession(tutor.tutorId, link.session_id))) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    const { error } = await service.from('sessions_files').update({ display_order: Number(displayOrder) }).eq('id', sessionFileId)
    if (error) throw error
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    captureApiError(error, '/api/session-files')
    return NextResponse.json({ error: 'Failed to update session file' }, { status: 500 })
  }
}
