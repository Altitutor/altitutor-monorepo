'use client'

import { useEffect, useState } from 'react'
import { refreshUcatImageUrls } from '@/features/ucat/question-engine-preview/lib/refresh-ucat-image-urls'

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
} {
  const [content, setContent] = useState<Record<string, unknown> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!hasContent(json)) {
      setContent(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    const doc = normalizeDoc(json as Record<string, unknown>)

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

    refreshUcatImageUrls(doc, createSignedUrl)
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
  }, [json])

  return { content, isLoading }
}
