import { getLinkCopyBody } from '../getLinkCopyBody';

it('copies distinct web links, preserving query strings and balanced parentheses', () => {
  expect(getLinkCopyBody('Try (https://example.test/Path_(one)?a=1&b=2), https://example.test/two. https://example.test/two'))
    .toBe('https://example.test/Path_(one)?a=1&b=2\nhttps://example.test/two');
});

it('returns no copy for a draft without web links', () => {
  expect(getLinkCopyBody('Call us or email admin@example.test.')).toBeUndefined();
});
