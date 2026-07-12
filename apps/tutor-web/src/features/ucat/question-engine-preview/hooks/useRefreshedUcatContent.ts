'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  applySignedUrlsToDoc,
  cacheSignedUrls,
  collectUcatImageRefsFromDoc,
  docStructureFingerprint,
  getCachedSignedUrlForFileId,
  getCachedSignedUrlForPath,
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

  const docStructureKey = useMemo(() => {
    if (!hasContent(json)) return ''
    return docStructureFingerprint(normalizeDoc(json as Record<string, unknown>))
  }, [json])

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

  // Keep displayed doc in sync when text changes (imagePathsKey alone is insufficient).
  // Apply cached signed URLs when available so editors never mount with expired JWTs.
  // Text-only docs (no image refs) must still set content — otherwise RichContentBlock
  // falls back to empty plainText and learning-module text previews render blank.
  useEffect(() => {
    const currentJson = jsonRef.current
    if (!hasContent(currentJson)) {
      setContent(null)
      return
    }
    const doc = normalizeDoc(currentJson as Record<string, unknown>)
    if (imagePathsKey !== '') {
      const refs = collectUcatImageRefsFromDoc(doc)
      const pathToUrl = new Map<string, string>()
      for (const path of refs.paths) {
        const cached = getCachedSignedUrlForPath(path)
        if (cached) pathToUrl.set(path, cached)
      }
      const fileIdToUrl = new Map<string, string>()
      for (const fileId of refs.fileIds) {
        const cached = getCachedSignedUrlForFileId(fileId)
        if (cached) fileIdToUrl.set(fileId, cached)
      }
      const allCached =
        refs.paths.every((path) => pathToUrl.has(path)) &&
        refs.fileIds.every((fileId) => fileIdToUrl.has(fileId))
      if (allCached) {
        setContent(applySignedUrlsToDoc(doc, pathToUrl, fileIdToUrl))
        return
      }
    }
    setContent(doc)
  }, [docStructureKey, imagePathsKey])

  useEffect(() => {
    const currentJson = jsonRef.current
    const prevKey = prevImagePathsKeyRef.current
    prevImagePathsKeyRef.current = imagePathsKey

    if (!hasContent(currentJson)) {
      setContent(null)
      setIsLoading(false)
      return
    }

    const doc = normalizeDoc(currentJson as Record<string, unknown>)
    if (imagePathsKey === '') {
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
      const cached = getCachedSignedUrlForPath(path)
      if (cached) return cached

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
      cacheSignedUrls([path], [], signedUrls)
      return signedUrls[0]
    }

    const createSignedUrlFromFileId = async (fileId: string): Promise<string> => {
      const cached = getCachedSignedUrlForFileId(fileId)
      if (cached) return cached

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
      cacheSignedUrls([], [fileId], signedUrls)
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
