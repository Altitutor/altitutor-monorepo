const DEFAULT_CACHE_TTL_MS = 50 * 60 * 1000;

export interface StoredImageHtmlRenderer {
  refresh: (html: string | null | undefined) => Promise<string>;
  preload: (html: string | null | undefined) => Promise<void>;
  clearCache: () => void;
}

export interface CreateStoredImageHtmlRendererOptions {
  bucket: string;
  resolveSignedUrls: (paths: string[]) => Promise<string[]>;
  cacheTtlMs?: number;
  now?: () => number;
}

/**
 * Creates a renderer for persisted HTML images whose durable identity is stored
 * in data-storage-bucket/data-storage-path attributes. Signed src URLs are only
 * a render-time projection and are never treated as the durable reference.
 */
export function createStoredImageHtmlRenderer({
  bucket,
  resolveSignedUrls,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  now = Date.now,
}: CreateStoredImageHtmlRendererOptions): StoredImageHtmlRenderer {
  const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
  const hasBucketMarker = (html: string): boolean =>
    html.includes(`data-storage-bucket="${bucket}"`) ||
    html.includes(`data-storage-bucket='${bucket}'`);

  const refresh = async (html: string | null | undefined): Promise<string> => {
    if (!html || !hasBucketMarker(html)) return html ?? '';
    if (typeof DOMParser === 'undefined') return html;

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const images = Array.from(
      doc.querySelectorAll<HTMLImageElement>(
        `img[data-storage-bucket="${bucket}"][data-storage-path]`,
      ),
    );
    const paths = images
      .map((image) => image.getAttribute('data-storage-path'))
      .filter((path): path is string => Boolean(path));
    const uniquePaths = [...new Set(paths)];
    if (uniquePaths.length === 0) return html;

    const currentTime = now();
    const missingPaths = uniquePaths.filter((path) => {
      const cached = signedUrlCache.get(path);
      if (cached && cached.expiresAt > currentTime) return false;
      signedUrlCache.delete(path);
      return true;
    });

    if (missingPaths.length > 0) {
      const signedUrls = await resolveSignedUrls(missingPaths);
      const expiresAt = now() + cacheTtlMs;
      missingPaths.forEach((path, index) => {
        const signedUrl = signedUrls[index];
        if (signedUrl) signedUrlCache.set(path, { url: signedUrl, expiresAt });
      });
    }

    for (const image of images) {
      const path = image.getAttribute('data-storage-path');
      const signedUrl = path ? signedUrlCache.get(path)?.url : null;
      if (signedUrl) image.setAttribute('src', signedUrl);
    }

    return doc.body.innerHTML;
  };

  const preload = async (html: string | null | undefined): Promise<void> => {
    const refreshedHtml = await refresh(html);
    if (!refreshedHtml || typeof DOMParser === 'undefined') return;

    const doc = new DOMParser().parseFromString(refreshedHtml, 'text/html');
    const urls = Array.from(doc.querySelectorAll<HTMLImageElement>('img[src]'))
      .map((image) => image.getAttribute('src'))
      .filter((src): src is string => Boolean(src));
    if (typeof Image === 'undefined') return;

    await Promise.allSettled(
      [...new Set(urls)].map(
        (src) =>
          new Promise<void>((resolve) => {
            const image = new Image();
            image.onload = () => resolve();
            image.onerror = () => resolve();
            image.src = src;
          }),
      ),
    );
  };

  return {
    refresh,
    preload,
    clearCache: () => signedUrlCache.clear(),
  };
}
