import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { supabaseAdmin } from '@/shared/lib/supabase/server/admin'
import { REFRESHED_URL_EXPIRY_SECONDS } from '@/features/ucat/question-engine-preview/lib/refresh-ucat-image-urls'

/** Path must look like ucat-images storage path: temp/uuid/file or uuid/file, no traversal. */
const VALID_PATH = /^[a-zA-Z0-9/_.-]+$/

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  let body: { paths?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const paths = body.paths
  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json({ error: 'paths must be a non-empty array' }, { status: 400 })
  }

  if (paths.length > 50) {
    return NextResponse.json({ error: 'Too many paths (max 50)' }, { status: 400 })
  }

  for (const p of paths) {
    if (typeof p !== 'string' || !VALID_PATH.test(p) || p.includes('..')) {
      return NextResponse.json({ error: `Invalid path: ${String(p).slice(0, 80)}` }, { status: 400 })
    }
  }

  const signedUrls: string[] = []
  for (const path of paths) {
    const { data, error } = await supabaseAdmin.storage
      .from('ucat-images')
      .createSignedUrl(path, REFRESHED_URL_EXPIRY_SECONDS)

    if (error) {
      return NextResponse.json(
        { error: error.message, path },
        { status: error.message === 'Object not found' ? 404 : 500 }
      )
    }

    if (!data?.signedUrl) {
      return NextResponse.json({ error: 'No signed URL returned', path }, { status: 500 })
    }

    signedUrls.push(data.signedUrl)
  }

  return NextResponse.json({ signedUrls })
}
