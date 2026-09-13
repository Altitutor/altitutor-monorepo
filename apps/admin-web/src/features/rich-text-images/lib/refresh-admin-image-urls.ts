const BUCKET = 'admin-rich-text-images';
const SIGNED_URL_PATTERN =
  /\/storage\/v1\/object\/sign\/admin-rich-text-images\/([^?]+)(?:\?|$)/;

type AdminImageRef =
  | { node: Record<string, unknown>; path: string; fileId?: null }
  | { node: Record<string, unknown>; path?: null; fileId: string };

function extractAdminImagePathFromSignedUrl(src: string): string | null {
  if (typeof src !== 'string' || !src.includes(BUCKET)) return null;
  const match = src.match(SIGNED_URL_PATTERN);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function imageRef(node: Record<string, unknown>): AdminImageRef | null {
  if (node.type !== 'image' || !node.attrs || typeof node.attrs !== 'object') {
    return null;
  }
  const attrs = node.attrs as Record<string, unknown>;
  if (
    attrs.storageBucket === BUCKET &&
    typeof attrs.storagePath === 'string' &&
    attrs.storagePath.length > 0
  ) {
    return { node, path: attrs.storagePath };
  }
  if (typeof attrs.src === 'string') {
    const path = extractAdminImagePathFromSignedUrl(attrs.src);
    if (path) return { node, path };
  }
  if (typeof attrs.fileId === 'string' && attrs.fileId.length > 0) {
    return { node, fileId: attrs.fileId };
  }
  return null;
}

function walkDoc(
  node: Record<string, unknown>,
  visit: (node: Record<string, unknown>) => void,
): void {
  visit(node);
  if (!Array.isArray(node.content)) return;
  for (const child of node.content) {
    if (child && typeof child === 'object') {
      walkDoc(child as Record<string, unknown>, visit);
    }
  }
}

export function collectAdminImageRefsFromDoc(doc: Record<string, unknown>): {
  paths: string[];
  fileIds: string[];
} {
  const paths = new Set<string>();
  const fileIds = new Set<string>();
  walkDoc(doc, (node) => {
    const ref = imageRef(node);
    if (!ref) return;
    if ('path' in ref && ref.path) paths.add(ref.path);
    else if (ref.fileId) fileIds.add(ref.fileId);
  });
  return { paths: [...paths], fileIds: [...fileIds] };
}

export function applyAdminSignedUrlsToDoc(
  doc: Record<string, unknown>,
  pathToUrl: Map<string, string>,
  fileIdToUrl: Map<string, string> = new Map(),
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
  walkDoc(result, (node) => {
    const ref = imageRef(node);
    if (!ref || !node.attrs || typeof node.attrs !== 'object') return;
    const attrs = node.attrs as Record<string, unknown>;
    const url =
      ('path' in ref && ref.path ? pathToUrl.get(ref.path) : undefined) ??
      (ref.fileId ? fileIdToUrl.get(ref.fileId) : undefined);
    if (url) {
      attrs.src = url;
      if ('path' in ref && ref.path) {
        attrs.storageBucket = BUCKET;
        attrs.storagePath = ref.path;
      }
    }
  });
  return result;
}

export function adminDocStructureFingerprint(
  doc: Record<string, unknown> | null | undefined,
): string {
  const parts: string[] = [];
  if (!doc) return '';
  walkDoc(doc, (node) => {
    parts.push(String(node.type ?? ''));
    if (node.type === 'image') {
      const attrs = node.attrs as Record<string, unknown> | undefined;
      parts.push(
        `img:${String(attrs?.storagePath ?? attrs?.fileId ?? attrs?.alt ?? '')}`,
      );
    } else if (typeof node.text === 'string') {
      parts.push(`t:${node.text}`);
    }
  });
  return parts.join('|');
}

const CACHE_TTL_MS = 23 * 60 * 60 * 1000;
type CachedSignedUrl = { url: string; expiresAt: number };

const signedUrlByPath = new Map<string, CachedSignedUrl>();
const signedUrlByFileId = new Map<string, CachedSignedUrl>();

function getCachedSignedUrl(
  cache: Map<string, CachedSignedUrl>,
  key: string,
): string | undefined {
  const cached = cache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt > Date.now()) return cached.url;
  cache.delete(key);
  return undefined;
}

export function getCachedAdminSignedUrlForPath(
  path: string,
): string | undefined {
  return getCachedSignedUrl(signedUrlByPath, path);
}

export function getCachedAdminSignedUrlForFileId(
  fileId: string,
): string | undefined {
  return getCachedSignedUrl(signedUrlByFileId, fileId);
}

export function cacheAdminSignedUrls(
  paths: string[],
  fileIds: string[],
  signedUrls: string[],
): void {
  const expiresAt = Date.now() + CACHE_TTL_MS;
  paths.forEach((path, index) => {
    const url = signedUrls[index];
    if (url) signedUrlByPath.set(path, { url, expiresAt });
  });
  fileIds.forEach((fileId, index) => {
    const url = signedUrls[paths.length + index];
    if (url) signedUrlByFileId.set(fileId, { url, expiresAt });
  });
}
