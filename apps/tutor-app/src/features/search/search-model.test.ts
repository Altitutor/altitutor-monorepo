import assert from 'node:assert/strict';
import test from 'node:test';

import { getEffectiveSearchScopes, groupSearchResults, searchPages, toggleSearchScope } from './search-model';

test('subject-qualified codes include resource scopes even when a different scope is selected', () => {
  assert.deepEqual(getEffectiveSearchScopes(['pages'], '12CHEM 2.2'), ['pages', 'topics', 'files', 'flashcards']);
  assert.deepEqual(getEffectiveSearchScopes(['pages'], 'session'), ['pages']);
});

test('scope selection can add, remove, and reset scopes', () => {
  const all = getEffectiveSearchScopes([], '');
  assert.deepEqual(toggleSearchScope(all, 'files'), ['files']);
  assert.deepEqual(toggleSearchScope(['files'], 'classes'), ['files', 'classes']);
  assert.deepEqual(toggleSearchScope(['files'], 'files'), all);
});

test('search page shortcuts rank direct matches and keep excluded workflows out', () => {
  assert.equal(searchPages('classes')[0]?.destination.href, '/classes');
  assert.equal(searchPages('dashboard')[0]?.destination.href, '/');
  assert.deepEqual(searchPages('interviews'), []);
  assert.deepEqual(groupSearchResults(['classes'], 'classes', []), []);
});

test('subject pages appear in empty suggestions and match each tutor-facing name', () => {
  const subjects = [{
    id: 'chemistry',
    name: 'Stage 2 Chemistry',
    short_name: '12CHEM',
    long_name: 'Year 12 Chemistry',
    curriculum: 'SACE' as const,
  }];
  const href = { pathname: '/resource-subject/[subjectId]', params: { subjectId: 'chemistry' } };

  assert.deepEqual(searchPages('', subjects).find(({ id }) => id === 'subject-page-chemistry')?.destination.href, href);
  for (const query of ['12chem', 'Stage 2 Chemistry', 'Year 12 Chemistry']) {
    const [group] = groupSearchResults(['pages'], query, [], subjects);
    assert.equal(group?.scope, 'pages');
    assert.deepEqual(group?.items[0]?.destination.href, href);
  }
  assert.deepEqual(groupSearchResults(['classes'], '12chem', [], subjects), []);
});
