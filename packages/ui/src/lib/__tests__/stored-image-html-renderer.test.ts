/** @jest-environment jsdom */

import { createStoredImageHtmlRenderer } from '../stored-image-html-renderer';

describe('createStoredImageHtmlRenderer', () => {
  it('renders a fresh URL from the durable storage path and caches it', async () => {
    const resolveSignedUrls = jest
      .fn()
      .mockResolvedValue(['https://storage.example/fresh.png?token=fresh']);
    const renderer = createStoredImageHtmlRenderer({
      bucket: 'flashcard-images',
      resolveSignedUrls,
    });
    const html =
      '<p>Prompt</p><img src="https://storage.example/expired.png?token=expired" data-file-id="file-1" data-storage-bucket="flashcard-images" data-storage-path="topic/image.png">';

    const first = await renderer.refresh(html);
    const second = await renderer.refresh(html);

    expect(first).toContain(
      'src="https://storage.example/fresh.png?token=fresh"',
    );
    expect(second).toBe(first);
    expect(resolveSignedUrls).toHaveBeenCalledTimes(1);
    expect(resolveSignedUrls).toHaveBeenCalledWith(['topic/image.png']);
  });

  it('leaves images from other buckets unchanged', async () => {
    const resolveSignedUrls = jest.fn();
    const renderer = createStoredImageHtmlRenderer({
      bucket: 'flashcard-images',
      resolveSignedUrls,
    });
    const html =
      '<img src="https://example.test/image.png" data-storage-bucket="other" data-storage-path="topic/image.png">';

    await expect(renderer.refresh(html)).resolves.toBe(html);
    expect(resolveSignedUrls).not.toHaveBeenCalled();
  });
});
