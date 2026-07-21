import { NextRequest, NextResponse } from 'next/server'
import type { TablesInsert } from '@altitutor/shared'
import { createClient } from '@/shared/lib/supabase/server-ssr'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import { captureApiError } from '@/lib/sentry/capture-api-error'

const BUCKET = 'staff-profile-images'
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

async function tutorId() {
  const client = createClient()
  const [{ data: isTutor }, { data: id }] = await Promise.all([
    client.rpc('is_tutor'),
    client.rpc('current_tutor_id'),
  ])
  return isTutor ? id : null
}

export async function GET(request: NextRequest) {
  try {
    const staffId = await tutorId()
    if (!staffId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const fileId = request.nextUrl.searchParams.get('fileId')
    if (!fileId) return NextResponse.json({ url: null })

    const service = getServiceRoleClient()
    const { data: staff } = await service
      .from('staff')
      .select('profile_image_file_id')
      .eq('id', staffId)
      .eq('profile_image_file_id', fileId)
      .maybeSingle()
    if (!staff) return NextResponse.json({ error: 'Image not found' }, { status: 404 })

    const { data: file, error } = await service
      .from('files')
      .select('bucket, storage_path')
      .eq('id', fileId)
      .eq('bucket', BUCKET)
      .maybeSingle()
    if (error) throw error
    if (!file?.storage_path) return NextResponse.json({ url: null })
    const { data } = service.storage.from(BUCKET).getPublicUrl(file.storage_path)
    return NextResponse.json({ url: data.publicUrl })
  } catch (error) {
    captureApiError(error, '/api/profile/image')
    return NextResponse.json({ error: 'Failed to load profile image' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const staffId = await tutorId()
    if (!staffId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || !IMAGE_TYPES.has(file.type) || file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Choose a JPEG, PNG, or WebP image up to 5 MB' }, { status: 400 })
    }

    const service = getServiceRoleClient()
    const path = `${staffId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const { data: uploaded, error: uploadError } = await service.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), {
        cacheControl: '31536000',
        contentType: file.type,
        upsert: false,
      })
    if (uploadError || !uploaded) throw uploadError ?? new Error('Upload failed')

    const insert: TablesInsert<'files'> = {
      mimetype: file.type,
      filename: file.name,
      size_bytes: file.size,
      metadata: { originalName: file.name, uploadedAt: new Date().toISOString(), purpose: 'staff-profile-image' },
      storage_provider: 'supabase',
      bucket: BUCKET,
      storage_path: uploaded.path,
      created_by: staffId,
    }
    const { data: created, error } = await service.from('files').insert(insert).select('id').single()
    if (error || !created) {
      await service.storage.from(BUCKET).remove([uploaded.path])
      throw error ?? new Error('Failed to create image record')
    }
    return NextResponse.json({ fileId: created.id }, { status: 201 })
  } catch (error) {
    captureApiError(error, '/api/profile/image')
    return NextResponse.json({ error: 'Failed to upload profile image' }, { status: 500 })
  }
}
