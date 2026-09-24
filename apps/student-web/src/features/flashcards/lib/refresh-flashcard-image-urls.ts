import { createStoredImageHtmlRenderer } from '@altitutor/ui';

type SignedUrlsResponse = {
  data?: { signedUrls?: string[] };
  error?: string;
};

const renderer = createStoredImageHtmlRenderer({
  bucket: 'flashcard-images',
  resolveSignedUrls: async (paths) => {
    const response = await fetch('/api/flashcards/images/signed-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });
    const json = (await response.json()) as SignedUrlsResponse;
    if (!response.ok) {
      throw new Error(json.error ?? 'Failed to refresh flashcard image URLs');
    }
    return json.data?.signedUrls ?? [];
  },
});

export const refreshFlashcardImageUrls = renderer.refresh;
export const preloadFlashcardImages = renderer.preload;
