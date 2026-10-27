import { loadResponsePages } from './load-response-pages';

it('includes older matching responses after the first 500, in query order', async () => {
  const rows = Array.from({ length: 501 }, (_, index) => ({ id: String(index), answer: index === 500 ? 'helpful' : 'other' }));
  const result = await loadResponsePages(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }));
  expect(result.filter((row) => row.answer === 'helpful')).toEqual([{ id: '500', answer: 'helpful' }]);
  expect(result).toHaveLength(501);
});

it('fails instead of returning a misleading partial report when a later page fails', async () => {
  await expect(loadResponsePages(async (from) => from === 0
    ? { data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null }
    : { data: null, error: { message: 'Read failed' } },
  )).rejects.toThrow('Read failed');
});
