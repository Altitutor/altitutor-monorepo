import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { deleteUcatImagesByFileIds } from '@/features/ucat/shared/ucatImages'

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = (await request.json()) as { fileIds?: unknown }
    const fileIds = Array.isArray(body.fileIds)
      ? body.fileIds.filter((id): id is string => typeof id === 'string')
      : []

    if (fileIds.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0 })
    }

    await deleteUcatImagesByFileIds(fileIds)
    return NextResponse.json({ ok: true, deleted: fileIds.length })
  } catch (error) {
    console.error('Failed to cleanup UCAT images:', error)
    return NextResponse.json({ error: 'Failed to cleanup UCAT images' }, { status: 400 })
  }
}

