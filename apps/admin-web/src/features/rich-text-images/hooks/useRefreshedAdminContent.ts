'use client';

import { useEffect, useState } from 'react';
import { refreshAdminImageUrls } from '../lib/refresh-admin-image-urls';

function hasContent(json: Record<string, unknown> | null | undefined): boolean {
  if (!json || typeof json !== 'object') return false;
  const content = json.content;
  return Array.isArray(content) && content.length > 0;
}

function hasAdminImages(json: Record<string, unknown>): boolean {
  let found = false;
  function walk(node: Record<string, unknown>): void {
    if (node.type === 'image' && node.attrs && typeof node.attrs === 'object') {
      const src = (node.attrs as Record<string, unknown>).src;
      if (typeof src === 'string' && src.includes('admin-rich-text-images')) {
        found = true;
      }
    }
    const content = node.content;
    if (Array.isArray(content)) {
      for (const child of content) {
        if (child && typeof child === 'object') {
          walk(child as Record<string, unknown>);
        }
      }
    }
  }
  walk(json);
  return found;
}

function normalizeDoc(json: Record<string, unknown>): Record<string, unknown> {
  if (json.type === 'doc' && Array.isArray(json.content)) {
    return json;
  }
  return {
    type: 'doc',
    content: Array.isArray(json.content) ? json.content : [json],
  };
}

/**
 * Returns content with refreshed Supabase signed URLs for admin-rich-text-images.
 * Signed URLs expire after 1 hour; this hook fetches fresh URLs when rendering.
 */
export function useRefreshedAdminContent(
  json: Record<string, unknown> | null | undefined
): {
  content: Record<string, unknown> | null;
  isLoading: boolean;
} {
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!hasContent(json)) {
      setContent(null);
      setIsLoading(false);
      return;
    }

    const doc = normalizeDoc(json as Record<string, unknown>);
    if (!hasAdminImages(doc)) {
      setContent(doc);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const createSignedUrl = async (path: string): Promise<string> => {
      const res = await fetch('/api/admin/rich-text-images/signed-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: [path] }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err?.error ?? `Failed to get signed URL: ${res.status}`);
      }
      const { signedUrls } = (await res.json()) as { signedUrls: string[] };
      if (!signedUrls?.[0]) throw new Error('No signed URL returned');
      return signedUrls[0];
    };

    refreshAdminImageUrls(doc, createSignedUrl)
      .then((refreshed) => {
        if (!cancelled) {
          setContent(refreshed);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContent(doc);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [json]);

  return { content, isLoading };
}
