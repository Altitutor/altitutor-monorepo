'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  adminDocStructureFingerprint,
  collectAdminImageRefsFromDoc,
} from '../lib/refresh-admin-image-urls';
import { resolveAdminImageUrls } from '../lib/resolve-admin-image-urls';

function normalizeDoc(json: Record<string, unknown>): Record<string, unknown> {
  if (json.type === 'doc' && Array.isArray(json.content)) return json;
  return {
    type: 'doc',
    content: Array.isArray(json.content) ? json.content : [json],
  };
}

export function useRefreshedAdminContent(
  json: Record<string, unknown> | null | undefined,
): {
  content: Record<string, unknown> | null;
  isLoading: boolean;
  hasImageRefs: boolean;
} {
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const jsonRef = useRef(json);
  jsonRef.current = json;

  const structureKey = useMemo(
    () => (json ? adminDocStructureFingerprint(normalizeDoc(json)) : ''),
    [json],
  );
  const referencesKey = useMemo(() => {
    if (!json) return '';
    const refs = collectAdminImageRefsFromDoc(normalizeDoc(json));
    return [
      ...refs.paths.sort().map((path) => `p:${path}`),
      ...refs.fileIds.sort().map((fileId) => `f:${fileId}`),
    ].join('\0');
  }, [json]);

  useEffect(() => {
    const currentJson = jsonRef.current;
    if (!currentJson) {
      setContent(null);
      setIsLoading(false);
      return;
    }
    const doc = normalizeDoc(currentJson);
    if (!referencesKey) {
      setContent(doc);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setContent(null);
    setIsLoading(true);
    resolveAdminImageUrls(doc)
      .then((resolved) => {
        if (!cancelled) setContent(resolved);
      })
      .catch(() => {
        if (!cancelled) setContent(doc);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [referencesKey, structureKey]);

  return { content, isLoading, hasImageRefs: referencesKey !== '' };
}
