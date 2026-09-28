import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyResourceMedia, embedRequestAllowed, playerEmbedUrl } from './resource-media';

const file = {
  externalUrl: null as string | null,
  mimetype: null as string | null,
};

test('youtube watch links become an inline player embed', () => {
  const media = classifyResourceMedia(
    { ...file, externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  );
  assert.equal(media.kind, 'embed');
  if (media.kind !== 'embed') return;
  assert.match(media.embedUrl, /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  assert.match(media.embedUrl, /playsinline=1/);
  assert.equal(embedRequestAllowed(media.embedUrl), true);
  assert.equal(embedRequestAllowed('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), true);
  assert.equal(embedRequestAllowed('https://evil.example/watch'), false);
});

test('stored video files stay native videos and images stay images', () => {
  assert.equal(
    classifyResourceMedia({ ...file, mimetype: 'video/mp4' }, 'https://files.example/lesson.mp4?token=1').kind,
    'video',
  );
  assert.equal(
    classifyResourceMedia({ ...file, mimetype: 'image/png' }, 'https://files.example/diagram.png').kind,
    'image',
  );
  assert.equal(
    classifyResourceMedia({ ...file, mimetype: 'application/pdf' }, 'https://files.example/notes.pdf').kind,
    'document',
  );
  assert.equal(classifyResourceMedia(file, null).kind, 'missing');
});

test('player params keep the embed on the video', () => {
  const url = new URL(playerEmbedUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'));
  assert.equal(url.searchParams.get('rel'), '0');
  assert.equal(url.searchParams.get('modestbranding'), '1');
});
