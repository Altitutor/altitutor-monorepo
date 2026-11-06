import assert from 'node:assert/strict';
import test from 'node:test';

import { collectDocumentImages, documentHtml } from './document-content';

const colors = { background: '#fff', text: '#000', border: '#ccc', link: '#0045ee' };

test('renders rich text and structural markup while treating raw text and URLs as untrusted', () => {
  const result = documentHtml({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '<script>', marks: [{ type: 'bold' }] }] },
      { type: 'text', text: 'Unsafe', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
      { type: 'text', text: 'Website', marks: [{ type: 'link', attrs: { href: 'https://example.com/?q=1&v=2' } }] },
      { type: 'details', attrs: { open: true }, content: [{ type: 'detailsSummary', content: [{ type: 'text', text: 'More' }] }] },
    ],
  }, colors, new Map());

  assert.match(result, /<h2><strong>&lt;script&gt;<\/strong><\/h2>/);
  assert.match(result, /<a href="https:\/\/example.com\/\?q=1&amp;v=2">Website<\/a>/);
  assert.match(result, /<details open><summary>More<\/summary><\/details>/);
  assert.doesNotMatch(result, /<script>|javascript:/);
});

test('only displays signed versions of stored documentation images', () => {
  const content = {
    type: 'doc',
    content: [{
      type: 'image',
      attrs: { src: 'https://expired.example/image.png', storageBucket: 'notes', storagePath: 'files/image.png', alt: 'Figure' },
    }],
  };
  const [image] = collectDocumentImages(content);
  assert.ok(image);
  const signed = new Map([[image.key, 'https://storage.example/image.png']]);
  assert.match(documentHtml(content, colors, signed), /<img src="https:\/\/storage.example\/image.png" alt="Figure">/);
  assert.doesNotMatch(documentHtml(content, colors, new Map()), /expired.example/);
});
