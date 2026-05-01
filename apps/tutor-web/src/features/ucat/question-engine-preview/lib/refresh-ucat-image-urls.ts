/**
 * Refreshes expired Supabase signed URLs in Tiptap JSON documents.
 * Signed URLs expire after 1 hour; this replaces them with fresh URLs when rendering.
 * Mirrors apps/ucat-web/src/features/question-engine/lib/refresh-ucat-image-urls.ts
 */

const UCAT_IMAGES_SIGNED_URL_PATTERN = /\/storage\/v1\/object\/sign\/ucat-images\/([^?]+)(?:\?|$)/

/** Extracts storage path from a Supabase ucat-images signed URL, or null if not matching. */
export function extractUcatImagePathFromSignedUrl(src: string): string | null {
  if (typeof src !== 'string' || !src.includes('ucat-images')) return null
  const match = src.match(UCAT_IMAGES_SIGNED_URL_PATTERN)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

/** Default expiry for refreshed URLs: 24 hours (covers a typical exam session). */
export const REFRESHED_URL_EXPIRY_SECONDS = 86400

/**
 * Recursively walks a Tiptap JSON document and replaces ucat-images signed URLs
 * with fresh signed URLs. Returns a deep clone with updated image srcs.
 */
export async function refreshUcatImageUrls(
  doc: Record<string, unknown>,
  createSignedUrl: (path: string) => Promise<string>
): Promise<Record<string, unknown>> {
  const result = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>
  const nodesToRefresh: Array<{ node: Record<string, unknown>; path: string }> = []

  function walk(node: Record<string, unknown>): void {
    if (node.type === 'image' && node.attrs && typeof node.attrs === 'object') {
      const attrs = node.attrs as Record<string, unknown>
      const src = attrs.src
      if (typeof src === 'string') {
        const path = extractUcatImagePathFromSignedUrl(src)
        if (path) {
          nodesToRefresh.push({ node, path })
        }
      }
    }
    const content = node.content
    if (Array.isArray(content)) {
      for (const child of content) {
        if (child && typeof child === 'object') {
          walk(child as Record<string, unknown>)
        }
      }
    }
  }

  walk(result)

  const freshUrls = await Promise.all(nodesToRefresh.map(({ path }) => createSignedUrl(path)))

  for (let i = 0; i < nodesToRefresh.length; i++) {
    const attrs = nodesToRefresh[i].node.attrs as Record<string, unknown>
    if (attrs) {
      attrs.src = freshUrls[i]
    }
  }

  return result
}
