const BUCKET = 'flashcard-images';
const SIGNED_URL_CACHE_TTL_MS = 50 * 60 * 1000;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

type SignedUrlsResponse = {
  data?: {
    signedUrls?: string[];
  };
  error?: string;
};

export async function refreshFlashcardImageUrls(html: string | null | undefined): Promise<string> {
  if (!html || !html.includes(`data-storage-bucket="${BUCKET}"`)) return html ?? '';
  if (typeof window === 'undefined') return html;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const images = Array.from(doc.querySelectorAll<HTMLImageElement>(`img[data-storage-bucket="${BUCKET}"][data-storage-path]`));
  const paths = images
    .map((image) => image.getAttribute('data-storage-path'))
    .filter((path): path is string => Boolean(path));

  const uniquePaths = [...new Set(paths)];
  if (!uniquePaths.length) return html;

  const now = Date.now();
  const missingPaths = uniquePaths.filter((path) => {
    const cached = signedUrlCache.get(path);
    if (cached && cached.expiresAt > now) return false;
    signedUrlCache.delete(path);
    return true;
  });
  if (missingPaths.length) {
    const response = await fetch('/api/flashcards/images/signed-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: missingPaths }),
    });
    const json = (await response.json()) as SignedUrlsResponse;
    if (!response.ok) throw new Error(json.error ?? 'Failed to refresh flashcard image URLs');

    const signedUrls = json.data?.signedUrls ?? [];
    const expiresAt = Date.now() + SIGNED_URL_CACHE_TTL_MS;
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
}

export async function preloadFlashcardImages(html: string | null | undefined): Promise<void> {
  const refreshedHtml = await refreshFlashcardImageUrls(html);
  if (!refreshedHtml || typeof window === 'undefined') return;

  const doc = new DOMParser().parseFromString(refreshedHtml, 'text/html');
  const urls = Array.from(doc.querySelectorAll<HTMLImageElement>('img[src]'))
    .map((image) => image.getAttribute('src'))
    .filter((src): src is string => Boolean(src));

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
}
