import assert from 'node:assert/strict';
import test from 'node:test';

import { clozeHtml, replaceFlashcardImageUrls, storedFlashcardImagePaths } from './flashcard-html';

test('native cloze rendering hides only the active review card', () => {
  const text = 'A {{c1::cell::unit}} has a {{c2::nucleus}}.';
  assert.match(clozeHtml(text, 1, false), /… \(unit\)/);
  assert.match(clozeHtml(text, 1, false), /nucleus/);
  assert.doesNotMatch(clozeHtml(text, 1, false), />cell</);
  assert.match(clozeHtml(text, 1, true), />cell</);
});

test('stored flashcard images receive fresh URLs without changing other images', () => {
  const html = '<p>Prompt</p><img src="old" data-storage-bucket="flashcard-images" data-storage-path="topic/one.png"><img src="other" data-storage-bucket="resources" data-storage-path="topic/two.png">';
  assert.deepEqual(storedFlashcardImagePaths(html), ['topic/one.png']);
  const result = replaceFlashcardImageUrls(html, new Map([['topic/one.png', 'https://example.test/one.png?x=1&y=2']]));
  assert.match(result, /src="https:\/\/example\.test\/one\.png\?x=1&amp;y=2"/);
  assert.match(result, /src="other"/);
  assert.doesNotMatch(result, /src="old"/);
});
