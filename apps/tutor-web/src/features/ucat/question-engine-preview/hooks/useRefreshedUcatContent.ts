'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  collectUcatImageRefsFromDoc,
  refreshUcatImageUrls,
} from '@/features/ucat/question-engine-preview/lib/refresh-ucat-image-urls'

function hasContent(json: Record<string, unknown> | null | undefined): boolean {
  if (!json || typeof json !== 'object') return false
  const content = json.content
  return Array.isArray(content) && content.length > 0
}

function normalizeDoc(json: Record<string, unknown>): Record<string, unknown> {
  if (json.type === 'doc' && Array.isArray(json.content)) {
    return json
  }
  return {
    type: 'doc',
    content: Array.isArray(json.content) ? json.content : [json],
  }
}

/**
 * Returns content with refreshed Supabase signed URLs for ucat-images.
 * Signed URLs expire after 1 hour; this hook fetches fresh URLs when rendering.
 */
export function useRefreshedUcatContent(json: Record<string, unknown> | null | undefined): {
  content: Record<string, unknown> | null
  isLoading: boolean
  /** True when the doc contains ucat-images that need signed-URL refresh before display. */
  hasImageRefs: boolean
} {
  const [content, setContent] = useState<Record<string, unknown> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const jsonRef = useRef(json)
  jsonRef.current = json

  const imagePathsKey = useMemo(() => {
    if (!hasContent(json)) return ''
    const doc = normalizeDoc(json as Record<string, unknown>)
    const refs = collectUcatImageRefsFromDoc(doc)
    return [
      ...refs.paths.sort().map((path) => `p:${path}`),
      ...refs.fileIds.sort().map((fileId) => `f:${fileId}`),
    ].join('\0')
  }, [json])

  const hasImageRefs = imagePathsKey !== ''
  const prevImagePathsKeyRef = useRef(imagePathsKey)

  useEffect(() => {
    const json = jsonRef.current
    const prevKey = prevImagePathsKeyRef.current
    prevImagePathsKeyRef.current = imagePathsKey

    if (!hasContent(json)) {
      setContent(null)
      setIsLoading(false)
      return
    }

    const doc = normalizeDoc(json as Record<string, unknown>)
    if (imagePathsKey === '') {
      setContent(doc)
      setIsLoading(false)
      return
    }

    // Stem detail arrived after empty placeholder (async dialog load): drop stale text-only
    // content so consumers wait for refreshed URLs before mounting TipTap.
    if (prevKey === '' && imagePathsKey !== '') {
      setContent(null)
    }

    let cancelled = false
    setIsLoading(true)

    const createSignedUrl = async (path: string): Promise<string> => {
      const res = await fetch('/api/ucat/images/signed-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: [path] }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? `Failed to get signed URL: ${res.status}`)
      }
      const { signedUrls } = (await res.json()) as { signedUrls: string[] }
      if (!signedUrls?.[0]) throw new Error('No signed URL returned')
      return signedUrls[0]
    }

    const createSignedUrlFromFileId = async (fileId: string): Promise<string> => {
      const res = await fetch('/api/ucat/images/signed-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: [fileId] }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? `Failed to get signed URL: ${res.status}`)
      }
      const { signedUrls } = (await res.json()) as { signedUrls: string[] }
      if (!signedUrls?.[0]) throw new Error('No signed URL returned')
      return signedUrls[0]
    }

    refreshUcatImageUrls(doc, createSignedUrl, createSignedUrlFromFileId)
      .then((refreshed) => {
        if (!cancelled) {
          setContent(refreshed)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContent(doc)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [imagePathsKey])

  return { content, isLoading, hasImageRefs }
}
