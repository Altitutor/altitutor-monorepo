import { flashcardApi } from './flashcard-api';
import { replaceFlashcardImageUrls, storedFlashcardImagePaths } from './flashcard-html';

export async function refreshFlashcardHtmlImages(html: string): Promise<string> {
  const paths = storedFlashcardImagePaths(html);
  if (paths.length === 0) return html;
  const urls = new Map<string, string>();
  for (let start = 0; start < paths.length; start += 50) {
    const batch = paths.slice(start, start + 50);
    const response = await flashcardApi.signedImageUrls(batch);
    batch.forEach((path, index) => {
      const url = response.signedUrls[index];
      if (url) urls.set(path, url);
    });
  }
  return replaceFlashcardImageUrls(html, urls);
}
