const BUCKET = 'flashcard-images';

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

  const response = await fetch('/api/flashcards/images/signed-urls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths: uniquePaths }),
  });
  const json = (await response.json()) as SignedUrlsResponse;
  if (!response.ok) throw new Error(json.error ?? 'Failed to refresh flashcard image URLs');

  const signedUrls = json.data?.signedUrls ?? [];
  const signedByPath = new Map(uniquePaths.map((path, index) => [path, signedUrls[index]]));

  for (const image of images) {
    const path = image.getAttribute('data-storage-path');
    const signedUrl = path ? signedByPath.get(path) : null;
    if (signedUrl) image.setAttribute('src', signedUrl);
  }

  return doc.body.innerHTML;
}
