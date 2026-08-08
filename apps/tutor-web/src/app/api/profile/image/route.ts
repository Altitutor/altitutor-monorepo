import { NextRequest, NextResponse } from 'next/server'
import type { TablesInsert } from '@altitutor/shared'
import { createClient } from '@/shared/lib/supabase/server-ssr'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import { captureApiError } from '@/lib/sentry/capture-api-error'
import { normalizeProfileImageCrop } from '@/features/profile/types/profile-image'

const BUCKET = 'staff-profile-images'
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function metadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {}
}

function parseCrop(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return normalizeProfileImageCrop(null)
  try {
    return normalizeProfileImageCrop(JSON.parse(value))
  } catch {
    return normalizeProfileImageCrop(null)
  }
}

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
      .select('bucket, storage_path, metadata')
      .eq('id', fileId)
      .eq('bucket', BUCKET)
      .maybeSingle()
    if (error) throw error
    if (!file?.storage_path) return NextResponse.json({ url: null })
    const { data } = service.storage.from(BUCKET).getPublicUrl(file.storage_path)
    const metadata = metadataRecord(file.metadata)
    return NextResponse.json({
      url: data.publicUrl,
      crop: normalizeProfileImageCrop(metadata.profileImageCrop),
    })
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
    const crop = parseCrop(form.get('crop'))
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
      metadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        purpose: 'staff-profile-image',
        profileImageCrop: { x: crop.x, y: crop.y, zoom: crop.zoom },
      },
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

export async function PATCH(request: NextRequest) {
  try {
    const staffId = await tutorId()
    if (!staffId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json() as { fileId?: unknown; crop?: unknown }
    if (typeof body.fileId !== 'string') {
      return NextResponse.json({ error: 'Invalid profile image' }, { status: 400 })
    }

    const service = getServiceRoleClient()
    const { data: staff } = await service
      .from('staff')
      .select('profile_image_file_id')
      .eq('id', staffId)
      .eq('profile_image_file_id', body.fileId)
      .maybeSingle()
    if (!staff) return NextResponse.json({ error: 'Image not found' }, { status: 404 })

    const { data: file, error: fileError } = await service
      .from('files')
      .select('metadata')
      .eq('id', body.fileId)
      .eq('bucket', BUCKET)
      .maybeSingle()
    if (fileError) throw fileError
    if (!file) return NextResponse.json({ error: 'Image not found' }, { status: 404 })

    const crop = normalizeProfileImageCrop(body.crop)
    const { error: updateError } = await service
      .from('files')
      .update({
        metadata: {
          ...metadataRecord(file.metadata),
          profileImageCrop: {
            x: crop.x,
            y: crop.y,
            zoom: crop.zoom,
          },
        },
      })
      .eq('id', body.fileId)
    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (error) {
    captureApiError(error, '/api/profile/image')
    return NextResponse.json({ error: 'Failed to update profile image crop' }, { status: 500 })
  }
}
